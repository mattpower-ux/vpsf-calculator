import asyncio
import json
from io import BytesIO

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.routers import listing_import as listing


def page(**patch):
    home = {'@type': 'SingleFamilyResidence', 'address': {'streetAddress': '123 Example St', 'addressLocality': 'Denver', 'addressRegion': 'CO', 'postalCode': '80201'}, 'floorSize': {'value': 1800, 'unitCode': 'FTK'}, 'yearBuilt': 1998, 'numberOfBedrooms': 3, 'numberOfBathroomsTotal': 2}
    home.update(patch)
    return '<html><script type="application/ld+json">' + json.dumps(home) + '</script></html>'


def test_structured_home_only_no_inferred_facts():
    facts = listing.parse_listing(page())
    assert facts == {'address': '123 Example St', 'city': 'Denver', 'state': 'CO', 'zip': '80201', 'squareFeet': '1800', 'yearBuilt': '1998', 'bedrooms': '3', 'bathrooms': '2'}
    assert 'hvac' not in facts


def test_graph_and_quantitative_values():
    home = json.loads(page().split('application/ld+json">')[1].split('</script>')[0])
    home['numberOfBedrooms'] = {'value': 4}
    wrapped = '<script type="application/ld+json">' + json.dumps({'@graph': [{'@type': 'Organization', 'address': 'Wrong address'}, {'@type': 'RealEstateListing', 'mainEntity': home}]}) + '</script>'
    assert listing.parse_listing(wrapped)['bedrooms'] == '4'


def test_units_and_invalid_values_not_guessed():
    facts = listing.parse_listing(page(floorSize={'value': 150, 'unitCode': 'MTK'}, yearBuilt=True, numberOfBedrooms=-1, numberOfBathroomsTotal='many'))
    assert 'squareFeet' not in facts
    assert 'yearBuilt' not in facts
    assert 'bedrooms' not in facts
    assert 'bathrooms' not in facts


@pytest.mark.parametrize('html', ['<html>3 beds 2 baths</html>', '<script>alert(1)</script>', '<script type="application/ld+json">bad</script>', page() + page(address={'streetAddress': '456 Other St'})])
def test_missing_or_multiple_properties_require_manual_input(html):
    with pytest.raises(HTTPException) as error:
        listing.parse_listing(html)
    assert error.value.status_code == 422


@pytest.mark.parametrize('source,url', [('zillow','https://zillow.com.evil.test/home'), ('redfin','https://www.zillow.com/home'), ('realtor','http://www.realtor.com/home'), ('mls','https://user:password@public.test/home'), ('mls','https://public.test:8443/home')])
def test_source_domains_and_url_forms(source, url):
    with pytest.raises(HTTPException): listing.validate_source_url(source, url)


@pytest.fixture
def client():
    app = FastAPI(); app.include_router(listing.router)
    return TestClient(app)


def test_bare_mls_id_is_explicitly_unavailable(client, monkeypatch):
    monkeypatch.setattr(listing, 'download_listing', lambda *args: pytest.fail('No fake MLS lookup'))
    response = client.post('/api/listing-import', json={'source':'mls', 'listingId':'12345', 'market':'Example MLS'})
    assert response.status_code == 422
    assert 'provider' in response.json()['detail'].lower()


def test_endpoint_returns_review_facts(client, monkeypatch):
    monkeypatch.setattr(listing, 'download_listing', lambda *args: page())
    response = client.post('/api/listing-import', json={'source':'zillow', 'url':'https://www.zillow.com/homedetails/example'})
    assert response.status_code == 200
    assert response.json()['facts']['address'] == '123 Example St'
    assert 'review' in response.json()['sourceNote'].lower()
    assert 'score' not in response.json()
    assert response.headers['cache-control'] == 'no-store'


def mocked_download(monkeypatch, responses):
    calls = []
    monkeypatch.setattr(listing, 'public_destination', lambda url: ('www.zillow.com', '93.184.216.34', '/home'))
    class Sock:
        def settimeout(self, value): pass
        def shutdown(self, mode): pass
    class Connection:
        def __init__(self, host, ip, timeout): self.sock = Sock(); calls.append((host, ip))
        def connect(self): pass
        def request(self, *args, **kwargs): pass
        def getresponse(self): return responses.pop(0)
        def close(self): pass
    monkeypatch.setattr(listing, 'PinnedHTTPSConnection', Connection)
    return calls


class Response:
    def __init__(self, body=b'', status=200, headers=None):
        self.status = status; self.body = BytesIO(body)
        self.headers = headers or {'Content-Type':'text/html'}
    def getheader(self, key, default=None): return self.headers.get(key, default)
    def read1(self, count): return self.body.read(count)


def test_pinned_download_and_cross_domain_redirect(monkeypatch):
    calls = mocked_download(monkeypatch, [Response(page().encode())])
    assert 'Example St' in listing.download_listing('zillow', 'https://www.zillow.com/home')
    assert calls == [('www.zillow.com', '93.184.216.34')]
    calls = mocked_download(monkeypatch, [Response(status=302, headers={'Location':'https://internal.test/home'})])
    with pytest.raises(HTTPException): listing.download_listing('zillow', 'https://www.zillow.com/home')
    assert len(calls) == 1


@pytest.mark.parametrize('response', [Response(b'x' * (2 * 1024 * 1024 + 1)), Response(status=403), Response(status=429), Response(b'<html>captcha</html>'), Response(b'pdf', headers={'Content-Type':'application/pdf'})])
def test_size_captcha_and_provider_errors(monkeypatch, response):
    mocked_download(monkeypatch, [response])
    with pytest.raises(HTTPException) as error: listing.download_listing('zillow', 'https://www.zillow.com/home')
    assert error.value.status_code == 422


def test_private_mls_destination_rejected_before_connection(monkeypatch):
    def private(url): raise HTTPException(400, 'private')
    monkeypatch.setattr(listing, 'public_destination', private)
    monkeypatch.setattr(listing, 'PinnedHTTPSConnection', lambda *a: pytest.fail('Must not connect'))
    with pytest.raises(HTTPException): listing.download_listing('mls', 'https://private.test/home')



def test_hard_deadline_interrupts_slow_headers(monkeypatch):
    import threading
    import time
    stopped = threading.Event()
    monkeypatch.setattr(listing, 'DEADLINE', 0.04)
    monkeypatch.setattr(listing, 'public_destination', lambda url: ('www.zillow.com', '93.184.216.34', '/home'))
    class Sock:
        def shutdown(self, mode): stopped.set()
        def settimeout(self, timeout): pass
    class Connection:
        def __init__(self, *args): self.sock = Sock()
        def connect(self): pass
        def request(self, *args, **kwargs): pass
        def getresponse(self):
            assert stopped.wait(1), 'Hard deadline must interrupt header reads'
            return Response(page().encode())
        def close(self): pass
    monkeypatch.setattr(listing, 'PinnedHTTPSConnection', Connection)
    started = time.monotonic()
    with pytest.raises(HTTPException): listing.download_listing('zillow', 'https://www.zillow.com/home')
    assert stopped.is_set()
    assert time.monotonic() - started < 0.8


def test_bounded_workers_fail_without_queueing(client, monkeypatch):
    class Full:
        def acquire(self, blocking): return False
    monkeypatch.setattr(listing, '_slots', Full())
    monkeypatch.setattr(listing, 'download_listing', lambda *args: pytest.fail('No queued work'))
    response = client.post('/api/listing-import', json={'source':'redfin', 'url':'https://www.redfin.com/home'})
    assert response.status_code == 422
    assert 'busy' in response.json()['detail']


def test_multiple_conflicting_values_are_omitted():
    facts = listing.parse_listing(page() + page(numberOfBedrooms=4))
    assert facts['address'] == '123 Example St'
    assert 'bedrooms' not in facts


def test_rooms_are_never_used_as_bedrooms():
    facts = listing.parse_listing(page(numberOfBedrooms=None, numberOfRooms=9))
    assert 'bedrooms' not in facts
