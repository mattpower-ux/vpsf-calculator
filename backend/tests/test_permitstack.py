import asyncio
from contextlib import AsyncExitStack
from datetime import timedelta
from uuid import uuid4

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.config import Settings, get_settings
from app.db import Base, get_db
from app.integrations import permitstack as ps
from app.routers import properties, integrations


ADDRESS = {'address': '123 Main St', 'state': 'CA', 'zip': '92549'}


def permit(**overrides):
    row = dict(id='e185234d-49cb-4987-9daa-2f90eed6d791', permit_number='R-42',
               address_street='123 MAIN STREET', address_state='CA', address_zip='92549',
               address_city='Idyllwild', status='ISSUED', category='ROOFING',
               description_raw='Replace roof', date_issued='2025-01-02',
               owner_name='PRIVATE OWNER', contractor_name='PRIVATE CONTACT')
    row.update(overrides)
    return row


@pytest.fixture
def setup(monkeypatch):
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    settings = Settings()
    settings.permit_stack_api_key = 'test-secret'
    settings.permit_stack_monthly_limit = 2
    app = FastAPI()
    app.include_router(properties.router)
    app.include_router(integrations.router)
    def database():
        with Session(engine) as db:
            yield db
    app.dependency_overrides[get_db] = database
    app.dependency_overrides[get_settings] = lambda: settings
    calls = []
    payload = {'results': [permit()], 'total': 1, 'page': 1, 'per_page': 25}
    async def search(self, request):
        calls.append(request)
        return payload
    monkeypatch.setattr(ps.PermitStackClient, 'search', search)
    with TestClient(app) as client:
        yield client, engine, settings, calls, payload
    engine.dispose()


def test_exact_matching_and_no_feature_or_contact_inference(setup):
    client, _, _, calls, payload = setup
    for change in [{'address_street':'1123 Main St'}, {'address_street':'123 Main St Apt 2'},
                   {'address_state':'TX'}, {'address_zip':'92550'}, {'address_zip':None},
                   {'address_state':None}]:
        row = permit(); row.update(change); payload['results'].append(row)
    payload['total'] = len(payload['results'])
    response = client.post('/api/properties/permitstack', json=ADDRESS)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body['status'] == 'matched' and len(body['permits']) == 1
    assert body['permits'][0]['status'] == 'ISSUED'
    assert body['searchedRecords'] == 7 and len(calls) == 1
    assert not {'roof','roofAge','hvac','solar','provenance'} & body.keys()
    assert 'PRIVATE' not in response.text and 'test-secret' not in response.text


def test_cache_normalization_expiry_and_monthly_limit(setup):
    client, engine, settings, calls, _ = setup
    first = client.post('/api/properties/permitstack', json=ADDRESS).json()
    second = client.post('/api/properties/permitstack', json={**ADDRESS,'address':'123 MAIN STREET','state':'California','zip':'92549-1234'}).json()
    assert not first['cacheHit'] and second['cacheHit'] and len(calls) == 1
    with Session(engine) as db:
        cache = db.query(ps.PermitStackCacheRecord).one()
        cache.expires_at = ps.utc_now() - timedelta(seconds=1)
        db.commit()
    assert client.post('/api/properties/permitstack', json=ADDRESS).status_code == 200
    assert len(calls) == 2
    limiter = client.app.state.permitstack_limiter
    after_minute = limiter.clock() + 61
    limiter.clock = lambda: after_minute
    assert client.post('/api/properties/permitstack', json={**ADDRESS,'address':'125 Main St'}).status_code == 429
    assert len(calls) == 2
    assert client.post('/api/properties/permitstack', json=ADDRESS).json()['cacheHit']


def test_no_match_is_not_no_work_and_partial_search_is_visible(setup):
    client, _, _, _, payload = setup
    payload.update(results=[], total=400, total_capped=True, tier_window_clamped=True,
                   coverage_confidence={'confidence':'low','covered':False,'note':'Limited capture'})
    body = client.post('/api/properties/permitstack', json=ADDRESS).json()
    assert body['status'] == 'no_exact_match' and body['permits'] == []
    assert body['searchTruncated'] is True
    assert body['coverage']['covered'] is False and body['coverage']['tierWindowClamped'] is True
    assert 'not proof' in body['sourceNote']


def test_unconfigured_and_validation_make_no_calls(setup):
    client, _, settings, calls, _ = setup
    from app.inference_limits import InferenceLimiter
    clock = [1000.0]
    client.app.state.permitstack_limiter = InferenceLimiter(clock=lambda:clock[0],per_minute=3,per_hour=10)
    for invalid in [{}, {**ADDRESS,'state':'ZZ'}, {**ADDRESS,'zip':''},
                    {**ADDRESS,'address':'123 Main St, Idyllwild, CA 92549'}]:
        assert client.post('/api/properties/permitstack', json=invalid).status_code == 422
        clock[0] += 61
    settings.permit_stack_api_key = ''
    assert client.post('/api/properties/permitstack', json=ADDRESS).status_code == 503
    assert not calls


@pytest.mark.parametrize('status', [401,402,403,409,429,500])
def test_safe_upstream_errors_not_cached_and_attempt_counted(setup, monkeypatch, status):
    client, engine, _, calls, _ = setup
    async def fail(self, request):
        calls.append(request)
        response = httpx.Response(status, text='test-secret PRIVATE', request=httpx.Request('GET','https://api.permit-stack.com/v1/permits/search'))
        response.raise_for_status()
    monkeypatch.setattr(ps.PermitStackClient,'search',fail)
    response = client.post('/api/properties/permitstack',json=ADDRESS)
    assert response.status_code == 502
    assert 'PRIVATE' not in response.text and 'test-secret' not in response.text
    with Session(engine) as db:
        assert db.query(ps.PermitStackCacheRecord).count() == 0
        assert ps.usage_status(db)['usedThisMonth'] == 1


def test_status_nonsecret_and_retired_attom_preserved(setup):
    client, _, _, calls, _ = setup
    body = client.get('/api/integrations/status').json()['permitstack']
    assert body['configured'] and body['monthlyLimit'] == 2
    assert body['usedThisMonth'] == 0
    assert body['authenticationNotCheckedByStatus'] is True
    assert 'credentialsVerified' not in body
    assert 'test-secret' not in str(body)
    assert client.post('/api/properties/attom',json={'address':'123 Main St'}).status_code == 410
    assert not calls


def test_history_settings_are_bounded_and_status_is_nonsecret(setup, monkeypatch):
    from app.config import bounded_env_int
    client, _, settings, _, _ = setup
    assert settings.permit_stack_history_enabled is False
    assert settings.permit_stack_max_pages == 3
    assert settings.permit_stack_page_size == 50
    assert settings.permit_stack_max_records == 150
    monkeypatch.setenv('LOW_TEST', '-8')
    monkeypatch.setenv('HIGH_TEST', '900')
    assert bounded_env_int('LOW_TEST', 3, 1, 10) == 1
    assert bounded_env_int('HIGH_TEST', 3, 1, 10) == 10
    body = client.get('/api/integrations/status').json()['permitstack']
    assert body['historyEnabled'] is False
    assert body['maxPagesPerLookup'] == 3
    assert body['pageSize'] == 50
    assert body['maxRecordsPerLookup'] == 150
    assert 'test-secret' not in str(body)


def test_expanded_evidence_contract_accepts_legacy_and_history_shapes():
    from app.permitstack_schemas import PermitStackResponse
    request = ps.PermitStackRequest(**ADDRESS)
    legacy = ps.evidence_response(request, {
        'results': [permit()], 'total': 1, 'page': 1, 'per_page': 25,
    }).model_dump(mode='json')
    legacy_model = PermitStackResponse.model_validate(legacy)
    assert legacy_model.lookupMode == 'search'
    assert legacy_model.completeness == 'unknown'
    history = {
        **legacy,
        'lookupMode': 'address-history',
        'matchedBy': 'address',
        'parcelId': '',
        'completeness': 'partial',
        'pagesChecked': 2,
        'recordsChecked': 75,
        'stopReason': 'page-budget',
        'coverage': {
            **legacy['coverage'],
            'jurisdiction': 'Example County',
            'dataStatus': 'active',
            'freshness': 'current',
            'captureRatio': 0.82,
        },
    }
    model = PermitStackResponse.model_validate(history)
    assert model.lookupMode == 'address-history'
    assert model.recordsChecked == 75
    assert model.coverage.captureRatio == 0.82


def test_client_uses_fixed_endpoint_header_and_single_bounded_page(monkeypatch):
    requests = []
    def reply(request):
        requests.append(request)
        return httpx.Response(200,json={'results':[],'total':0,'page':1,'per_page':25})
    original = httpx.AsyncClient
    monkeypatch.setattr(ps.httpx,'AsyncClient',lambda **kwargs: original(transport=httpx.MockTransport(reply),**kwargs))
    result = asyncio.run(ps.PermitStackClient('test-secret').search(ps.PermitStackRequest(**ADDRESS)))
    assert result['results'] == [] and len(requests) == 1
    request = requests[0]
    assert str(request.url).startswith('https://api.permit-stack.com/v1/permits/search?')
    assert request.headers['X-API-Key'] == 'test-secret'
    assert request.url.params['address'] == '123 Main'
    assert request.url.params['page'] == '1' and request.url.params['per_page'] == '25'
    assert request.url.params['fields'] == 'summary' and request.url.params['record_kind'] == 'permit'
    assert 'test-secret' not in str(request.url)


def history_page(*rows, page=1, has_more=False, **overrides):
    payload = {
        'query': {'address': ADDRESS['address']}, 'found': bool(rows),
        'total_matches': len(rows), 'truncated': False,
        'distinct_addresses': [ADDRESS['address']] if rows else [],
        'distinct_jurisdictions': ['Idyllwild'] if rows else [],
        'fan_out_warning': False, 'summary': {}, 'coverage': {},
        'data_currency': {}, 'permits': list(rows), 'page': page,
        'per_page': 50, 'has_more': has_more,
    }
    payload.update(overrides)
    return payload


def test_property_history_and_property_by_parcel_use_fixed_origins(monkeypatch):
    requests = []
    def reply(request):
        requests.append(request)
        return httpx.Response(200, json=history_page())
    original = httpx.AsyncClient
    monkeypatch.setattr(ps.httpx, 'AsyncClient', lambda **kwargs: original(transport=httpx.MockTransport(reply), **kwargs))
    client = ps.PermitStackClient('test-secret')
    request = ps.PermitStackRequest(**ADDRESS, city='Idyllwild', parcel='12-34-567')
    asyncio.run(client.property_history(request, 2, 50))
    asyncio.run(client.property_by_parcel(request, 3, 40))
    assert [str(item.url).split('?')[0] for item in requests] == [
        'https://api.permit-stack.com/v1/property/history',
        'https://api.permit-stack.com/v1/property/by-parcel',
    ]
    assert dict(requests[0].url.params) == {
        'address': '123 Main St', 'city': 'Idyllwild', 'state': 'CA',
        'zip': '92549', 'page': '2', 'per_page': '50',
    }
    assert dict(requests[1].url.params) == {
        'parcel': '12-34-567', 'state': 'CA', 'page': '3', 'per_page': '40',
    }
    assert all(item.headers['X-API-Key'] == 'test-secret' for item in requests)
    assert all('test-secret' not in str(item.url) for item in requests)


def test_history_pagination_deduplicates_and_reports_complete():
    first, duplicate, second = permit(), permit(), permit(
        id='37d27b1f-c074-4ca5-848d-b8ef39a5c7b4', permit_number='R-43')
    class Client:
        async def property_history(self, request, page, per_page):
            return history_page(first, page=1, has_more=True) if page == 1 else history_page(duplicate, second, page=2)
    calls = []
    settings = Settings(); settings.permit_stack_max_pages=3; settings.permit_stack_page_size=50; settings.permit_stack_max_records=150
    result = asyncio.run(ps.collect_history(Client(), ps.PermitStackRequest(**ADDRESS), settings, lambda: calls.append(1)))
    assert [row['id'] for row in result.records] == [first['id'], second['id']]
    assert result.pages_checked == 2 and result.records_checked == 3
    assert result.completeness == 'complete' and result.stop_reason == 'exhausted'
    assert len(calls) == 2


def test_history_pagination_reports_page_and_provider_window_limits():
    row = permit()
    class PageLimited:
        async def property_history(self, request, page, per_page):
            return history_page(row, page=page, has_more=True)
    settings = Settings(); settings.permit_stack_max_pages=1; settings.permit_stack_page_size=50; settings.permit_stack_max_records=150
    limited = asyncio.run(ps.collect_history(PageLimited(), ps.PermitStackRequest(**ADDRESS), settings, lambda: None))
    assert limited.completeness == 'partial' and limited.stop_reason == 'page-budget'
    class WindowLimited:
        async def property_history(self, request, page, per_page):
            return history_page(row, coverage={'tier_window_from':'2026-01-01'})
    settings.permit_stack_max_pages=3
    window = asyncio.run(ps.collect_history(WindowLimited(), ps.PermitStackRequest(**ADDRESS), settings, lambda: None))
    assert window.completeness == 'partial' and window.stop_reason == 'provider-window'


def test_history_fan_out_is_ambiguous_and_quota_exhaustion_is_partial():
    from fastapi import HTTPException
    row = permit()
    class Ambiguous:
        async def property_history(self, request, page, per_page):
            return history_page(row, distinct_addresses=['123 Main St','123 Main St Apt 2'], fan_out_warning=True)
    settings = Settings(); settings.permit_stack_max_pages=3; settings.permit_stack_page_size=50; settings.permit_stack_max_records=150
    ambiguous = asyncio.run(ps.collect_history(Ambiguous(), ps.PermitStackRequest(**ADDRESS), settings, lambda: None))
    assert ambiguous.completeness == 'ambiguous' and ambiguous.records == []
    class TwoPages:
        async def property_history(self, request, page, per_page):
            return history_page(row, page=page, has_more=True)
    reservations = 0
    def reserve():
        nonlocal reservations
        reservations += 1
        if reservations == 2: raise HTTPException(429, 'cap')
    partial = asyncio.run(ps.collect_history(TwoPages(), ps.PermitStackRequest(**ADDRESS), settings, reserve))
    assert len(partial.records) == 1 and partial.completeness == 'partial'
    assert partial.stop_reason == 'page-budget'
    with pytest.raises(HTTPException) as error:
        asyncio.run(ps.collect_history(TwoPages(), ps.PermitStackRequest(**ADDRESS), settings,
                                       lambda: (_ for _ in ()).throw(HTTPException(429, 'cap'))))
    assert error.value.status_code == 429


def test_history_rejects_repeated_pages_invalid_ids_and_unexpected_schema():
    row = permit()
    settings = Settings(); settings.permit_stack_max_pages=3; settings.permit_stack_page_size=50; settings.permit_stack_max_records=150
    class Repeated:
        async def property_history(self, request, page, per_page):
            return history_page(row, page=page, has_more=True)
    with pytest.raises(ValueError, match='repeated'):
        asyncio.run(ps.collect_history(Repeated(), ps.PermitStackRequest(**ADDRESS), settings, lambda: None))
    class Invalid:
        async def property_history(self, request, page, per_page):
            return history_page(permit(id='not-a-uuid'))
    with pytest.raises(ValueError):
        asyncio.run(ps.collect_history(Invalid(), ps.PermitStackRequest(**ADDRESS), settings, lambda: None))
    class Malformed:
        async def property_history(self, request, page, per_page): return {'permits': []}
    with pytest.raises(ValueError):
        asyncio.run(ps.collect_history(Malformed(), ps.PermitStackRequest(**ADDRESS), settings, lambda: None))


def test_history_evidence_sanitizes_maps_coverage_and_preserves_counts():
    rows = []
    for index in range(150):
        rows.append(permit(
            id=str(uuid4()), permit_number=f'R-{index}',
            owner_name='PRIVATE OWNER', contractor_email='private@example.com',
            raw={'private': True}, unrecognized_secret='hidden'))
    collection = ps.HistoryCollection(
        records=rows, lookup_mode='address-history',
        coverage={
            'confidence': 'high', 'covered': True,
            'jurisdiction': 'Example County', 'data_status': 'active',
            'freshness': 'current', 'capture_ratio': 0.82,
            'capture_checked_at': '2026-11-20',
            'capture_note': 'Representative municipal coverage.',
            'tier_window_from': '2016-01-01',
        },
        data_currency={'data_through': '2026-11-18'},
        pages_checked=3, records_checked=150,
        completeness='partial', stop_reason='record-budget')
    response = ps.history_evidence_response(ps.PermitStackRequest(**ADDRESS), collection)
    body = response.model_dump(mode='json')
    assert len(body['permits']) == 150
    assert body['lookupMode'] == 'address-history'
    assert body['matchedBy'] == 'address'
    assert body['pagesChecked'] == 3 and body['recordsChecked'] == 150
    assert body['completeness'] == 'partial' and body['stopReason'] == 'record-budget'
    assert body['coverage']['jurisdiction'] == 'Example County'
    assert body['coverage']['dataThrough'] == '2026-11-18'
    assert body['coverage']['captureRatio'] == 0.82
    serialized = str(body)
    assert 'PRIVATE OWNER' not in serialized
    assert 'private@example.com' not in serialized
    assert 'unrecognized_secret' not in serialized


def test_cache_key_preserves_legacy_and_varies_for_history_identity_and_limits():
    settings = Settings()
    request = ps.PermitStackRequest(**ADDRESS)
    legacy = ps.permit_cache_key(request, settings)
    assert legacy == ps.permit_cache_key(
        ps.PermitStackRequest(**{**ADDRESS, 'address': '123 MAIN STREET'}), settings)
    settings.permit_stack_history_enabled = True
    base = ps.permit_cache_key(request, settings)
    variants = []
    for field, value in [
        ('permit_stack_max_pages', 4),
        ('permit_stack_page_size', 40),
        ('permit_stack_max_records', 120),
    ]:
        changed = Settings()
        changed.permit_stack_history_enabled = True
        setattr(changed, field, value)
        variants.append(ps.permit_cache_key(request, changed))
    variants.append(ps.permit_cache_key(
        ps.PermitStackRequest(**ADDRESS, parcel='12-34-567'), settings))
    assert all(key != base for key in variants)
    assert len(set(variants)) == len(variants)


def test_history_mode_uses_property_history_and_caches_normalized_evidence(setup, monkeypatch):
    client, _, settings, search_calls, _ = setup
    settings.permit_stack_history_enabled = True
    history_calls = []
    async def property_history(self, request, page, per_page):
        history_calls.append((request, page, per_page))
        return history_page(permit(), coverage={'covered': True},
                            data_currency={'data_through': '2026-11-18'})
    monkeypatch.setattr(ps.PermitStackClient, 'property_history', property_history)
    first = client.post('/api/properties/permitstack', json=ADDRESS)
    second = client.post('/api/properties/permitstack', json=ADDRESS)
    assert first.status_code == second.status_code == 200
    assert first.json()['lookupMode'] == 'address-history'
    assert first.json()['completeness'] == 'complete'
    assert first.json()['coverage']['dataThrough'] == '2026-11-18'
    assert second.json()['cacheHit'] is True
    assert len(history_calls) == 1 and not search_calls


@pytest.mark.parametrize('address,prefix', [
    ('123 Main St','123 Main'), ('123 Main Street','123 Main'),
    ('123 Main St. NW','123 Main'), ('123 Main Street Northwest','123 Main'),
    ('123 N Main Street','123 N Main'), ('123 North Main Street','123 North Main'),
    ('123 Main St Apt 2','123 Main St Apt 2'), ('123 North St','123 North'),
    ('123 Broadway','123 Broadway')])
def test_search_prefix_is_conservative(address,prefix):
    assert ps.search_address_prefix(address) == prefix


def test_prefix_results_still_require_full_suffix_and_direction_match():
    request = ps.PermitStackRequest(**dict(ADDRESS,address='123 Main Street NW'))
    rows=[]
    for street in ['123 Main St NW','123 Main Ave NW','123 Main St NE','1123 Main St NW','123 Main St NW Apt 2']:
        row=permit(); row['address_street']=street; rows.append(row)
    result=ps.evidence_response(request,{'results':rows,'total':5,'page':1,'per_page':25})
    assert len(result.permits)==1 and result.permits[0].address=='123 Main St NW'


@pytest.mark.parametrize('status', ['ISSUED','CANCELLED','FINAL'])
def test_permit_metadata_survives_storage_without_scoring(setup, status):
    from app.schemas import PropertyInput, PropertyQueryCreate, PropertyQueryProgress
    from app.repositories import create_property, create_property_query, record_query_progress, find_saved_property_query
    from app.scoring.seed import seed_model_v1
    from app.scoring.catalog import evaluate_model
    from app.routers.admin import scoring_available_fields
    client, engine, _, _, payload = setup
    payload['results'][0].update(status=status, date_completed='2025-06-01')
    evidence = client.post('/api/properties/permitstack',json=ADDRESS).json()
    home = PropertyInput(**ADDRESS, permitEvidence=evidence)
    snapshot = home.model_dump(mode='json')
    assert snapshot['permitEvidence'] == evidence
    assert home.roofAge == 'Unknown'
    model = seed_model_v1()
    assert evaluate_model(home,model) == evaluate_model(PropertyInput(**ADDRESS),model)
    assert 'permitEvidence' not in scoring_available_fields()
    with Session(engine) as db:
        saved = create_property(db,home)
        assert saved.input_snapshot['permitEvidence']['permits'][0]['status'] == status
        query = create_property_query(db,PropertyQueryCreate(sessionId='permit-test',**ADDRESS,snapshot=snapshot))
        record_query_progress(db,PropertyQueryProgress(sessionId='permit-test',queryId=query.id,screen=1,screenLabel='Details',snapshot=snapshot))
        archived = find_saved_property_query(db,**dict(address=ADDRESS['address'],city='',state='CA',zip_code='92549'))
        assert archived.latest_snapshot['permitEvidence'] == evidence


def test_permit_metadata_cannot_become_a_scoring_factor():
    from pydantic import ValidationError
    from app.scoring.seed import seed_model_v1
    from app.scoring.catalog import ScoreModel
    model = seed_model_v1().model_dump()
    model['factors'][0].update(field='permitEvidence')
    with pytest.raises(ValidationError):
        ScoreModel.model_validate(model)


def test_atomic_cap_with_concurrent_sessions(tmp_path):
    from concurrent.futures import ThreadPoolExecutor
    from fastapi import HTTPException
    engine = create_engine(f'sqlite:///{tmp_path / "permit-test.db"}',connect_args={'timeout':10})
    Base.metadata.create_all(engine)
    def reserve(_):
        with Session(engine) as db:
            try:
                ps.reserve_call(db,3)
                return True
            except HTTPException as error:
                assert error.status_code == 429
                return False
    with ThreadPoolExecutor(max_workers=8) as pool:
        assert sum(pool.map(reserve,range(16))) == 3
    with Session(engine) as db:
        assert ps.usage_status(db)['usedThisMonth'] == 3
    engine.dispose()


@pytest.mark.parametrize('payload', [{'results':[]}, {'results':[{}]*26,'total':26,'page':1,'per_page':25},
                                   {'results':[],'total':0,'page':2,'per_page':25}])
def test_malformed_provider_data_is_not_cached(setup, payload):
    client, engine, _, _, supplied = setup
    supplied.clear(); supplied.update(payload)
    assert client.post('/api/properties/permitstack',json=ADDRESS).status_code == 502
    with Session(engine) as db:
        assert db.query(ps.PermitStackCacheRecord).count() == 0


def test_client_rejects_large_responses_and_redirects(monkeypatch):
    original = httpx.AsyncClient
    for status, body, expected in [(200,b' '*(ps.MAX_RESPONSE_BYTES+1),ValueError),
                                   (302,b'',httpx.HTTPStatusError)]:
        calls = []
        def reply(request):
            calls.append(request)
            return httpx.Response(status,content=body,headers={'Location':'https://other.example/'})
        monkeypatch.setattr(ps.httpx,'AsyncClient',lambda **kwargs: original(transport=httpx.MockTransport(reply),**kwargs))
        with pytest.raises(expected):
            asyncio.run(ps.PermitStackClient('test-secret').search(ps.PermitStackRequest(**ADDRESS)))
        assert len(calls) == 1


def test_bounded_property_evidence_and_json_native_storage(setup):
    import json
    from pydantic import ValidationError
    from app.schemas import PropertyInput
    client, _, _, _, _ = setup
    evidence = client.post('/api/properties/permitstack',json=ADDRESS).json()
    json.dumps(PropertyInput(permitEvidence=evidence).model_dump())
    for changed in [dict(evidence,permits=evidence['permits']*501),
                    dict(evidence,sourceNote='x'*1001),
                    dict(evidence,fetchedAt='2026-11-15'),
                    dict(evidence,permits=[dict(evidence['permits'][0],description='x'*2001)])]:
        with pytest.raises(ValidationError):
            PropertyInput(permitEvidence=changed)


def test_score_endpoint_retains_evidence_without_score_or_confidence_change(setup):
    from app.routers import scoring
    from app.scoring.store import seed_published
    from app.models import ScoreRunRecord
    client, engine, _, _, _ = setup
    client.app.include_router(scoring.router)
    with Session(engine) as db:
        seed_published(db)
    evidence = client.post('/api/properties/permitstack',json=ADDRESS).json()
    baseline = client.post('/api/score',json=ADDRESS)
    enriched = client.post('/api/score',json={**ADDRESS,'permitEvidence':evidence})
    assert baseline.status_code == enriched.status_code == 200
    for key in ['scores','total','confidence','explanations','improvements']:
        assert baseline.json()[key] == enriched.json()[key]
    with Session(engine) as db:
        assert db.get(ScoreRunRecord,enriched.json()['scoreRunId']).input_snapshot['permitEvidence'] == evidence


def test_timeout_is_safe_and_not_cached(setup, monkeypatch):
    client, engine, _, _, _ = setup
    async def timeout(self, request):
        raise httpx.ReadTimeout('test-secret')
    monkeypatch.setattr(ps.PermitStackClient,'search',timeout)
    response = client.post('/api/properties/permitstack',json=ADDRESS)
    assert response.status_code == 504 and 'test-secret' not in response.text
    with Session(engine) as db:
        assert db.query(ps.PermitStackCacheRecord).count() == 0


def test_zero_cap_and_month_rollover(setup, monkeypatch):
    from datetime import datetime, timezone
    client, engine, settings, calls, _ = setup
    settings.permit_stack_monthly_limit = 0
    assert client.post('/api/properties/permitstack',json=ADDRESS).status_code == 429
    assert not calls
    with Session(engine) as db:
        monkeypatch.setattr(ps,'utc_now',lambda: datetime(2026,11,30,tzinfo=timezone.utc))
        ps.reserve_call(db,1)
        monkeypatch.setattr(ps,'utc_now',lambda: datetime(2026,12,1,tzinfo=timezone.utc))
        assert ps.usage_status(db)['usedThisMonth'] == 0
        ps.reserve_call(db,1)
        assert ps.usage_status(db)['usedThisMonth'] == 1


def test_public_admission_limits_cache_hits_and_ignores_forwarded_ip(setup):
    client, _, _, calls, _ = setup
    for i in range(3):
        assert client.post('/api/properties/permitstack',json=ADDRESS,
                           headers={'X-Forwarded-For':f'192.0.2.{i}'}).status_code == 200
    denied = client.post('/api/properties/permitstack',json=ADDRESS)
    assert denied.status_code == 429 and int(denied.headers['retry-after']) > 0
    assert len(calls) == 1


def test_permit_hourly_limit_preserves_ocr_allowance(setup, monkeypatch):
    from app.inference_limits import InferenceLimiter
    from app.schemas import PropertyInput
    client, _, _, calls, _ = setup
    clock = [1000.0]
    client.app.state.permitstack_limiter = InferenceLimiter(clock=lambda:clock[0],per_minute=3,per_hour=10)
    for i in range(10):
        if i and i % 3 == 0: clock[0] += 61
        assert client.post('/api/properties/permitstack',json=ADDRESS).status_code == 200
    rejected=client.post('/api/properties/permitstack',json=ADDRESS)
    assert rejected.status_code == 429 and int(rejected.headers['retry-after']) > 61
    async def ocr(*args): return PropertyInput()
    monkeypatch.setattr(properties,'extract_property_from_url',ocr)
    for _ in range(30):
        assert client.post('/api/properties/ocr-url',json={'url':'https://example.com/report.pdf'}).status_code == 200
    assert client.post('/api/properties/ocr-url',json={'url':'https://example.com/report.pdf'}).status_code == 429
    assert len(calls) == 1
    clock[0] += 3601
    assert client.post('/api/properties/permitstack',json=ADDRESS).status_code == 200


@pytest.mark.parametrize('failure', [False, True])
def test_concurrent_identical_requests_share_one_attempt_and_release(setup, monkeypatch, failure):
    client, engine, settings, calls, payload = setup
    settings.permit_stack_monthly_limit = 10
    async def run():
        entered, release = asyncio.Event(), asyncio.Event()
        all_entered = asyncio.Event()
        lookup_count = 0
        original_lookup = properties.lookup_permits
        async def tracked_lookup(*args):
            nonlocal lookup_count
            lookup_count += 1
            if lookup_count == 4: all_entered.set()
            return await original_lookup(*args)
        monkeypatch.setattr(properties,'lookup_permits',tracked_lookup)
        async def provider(self, request):
            calls.append(request); entered.set()
            await release.wait()
            if failure:
                raise httpx.ReadTimeout('test-secret')
            return payload
        monkeypatch.setattr(ps.PermitStackClient,'search',provider)
        async with AsyncExitStack() as stack:
            clients = [await stack.enter_async_context(httpx.AsyncClient(
                transport=httpx.ASGITransport(app=client.app,client=(f'192.0.2.{i}',123)),
                base_url='http://test')) for i in range(5)]
            ac = clients[0]
            first=asyncio.create_task(ac.post('/api/properties/permitstack',json=ADDRESS))
            await asyncio.wait_for(entered.wait(),2)
            others=[asyncio.create_task(other.post('/api/properties/permitstack',json={**ADDRESS,'address':'123 MAIN STREET'})) for other in clients[1:4]]
            for _ in range(100):
                if client.app.state.permitstack_limiter.active == 4: break
                await asyncio.sleep(0.01)
            assert client.app.state.permitstack_limiter.active == 4
            denied=await clients[4].post('/api/properties/permitstack',json={**ADDRESS,'address':'125 Main St'})
            assert denied.status_code == 503 and denied.headers['retry-after']
            # Admission happens before async dependency resolution; wait until
            # all four handlers actually enter lookup before releasing failure.
            await asyncio.wait_for(all_entered.wait(),2)
            release.set()
            responses=await asyncio.gather(first,*others)
            assert [r.status_code for r in responses] == [504 if failure else 200]*4
            assert len(calls) == 1
            if not failure:
                assert responses[1].json()['address'] == '123 MAIN STREET'
            assert client.app.state.permitstack_limiter.active == 0
            retry=await ac.post('/api/properties/permitstack',json=ADDRESS)
            assert retry.status_code == (504 if failure else 200)
            assert len(calls) == (2 if failure else 1)
    asyncio.run(run())
    with Session(engine) as db:
        assert ps.usage_status(db)['usedThisMonth'] == (2 if failure else 1)


def test_cancelled_follower_does_not_cancel_shared_provider(setup, monkeypatch):
    client, _, _, calls, payload = setup
    async def run():
        entered, release = asyncio.Event(), asyncio.Event()
        async def provider(self, request):
            calls.append(request); entered.set(); await release.wait(); return payload
        monkeypatch.setattr(ps.PermitStackClient,'search',provider)
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=client.app),base_url='http://test') as ac:
            first=asyncio.create_task(ac.post('/api/properties/permitstack',json=ADDRESS))
            await asyncio.wait_for(entered.wait(),2)
            second=asyncio.create_task(ac.post('/api/properties/permitstack',json=ADDRESS))
            await asyncio.sleep(0.05)
            second.cancel()
            with pytest.raises(asyncio.CancelledError): await second
            release.set()
            assert (await first).status_code == 200
            assert len(calls) == 1
            assert client.app.state.permitstack_limiter.active == 0
    asyncio.run(run())
