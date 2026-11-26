from datetime import datetime, timedelta, timezone
import json
from types import SimpleNamespace

import httpx
import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app import models
from app.db import Base
from app.photo_evidence import (
    PhotoCandidate,
    candidates_from_search,
    match_photo_candidate,
    rank_photo_candidates,
)
from app.routers import photo_evidence as router


ADDRESS = '2256 Fallen Tree Drive E, Jacksonville, FL 32246'
ZILLOW = 'https://www.zillow.com/homedetails/2256-Fallen-Tree-Dr-E-Jacksonville-FL-32246/44605347_zpid/'


def raw_candidate(**overrides):
    row = {
        'title': '2256 Fallen Tree Dr E, Jacksonville, FL 32246',
        'snippet': 'Home in Jacksonville, FL 32246',
        'url': ZILLOW,
        'imageUrl': 'https://photos.zillowstatic.com/fp/front.jpg',
        'imageWidth': 1536,
        'imageHeight': 1152,
    }
    row.update(overrides)
    return row


def test_match_photo_candidate_accepts_exact_address_suffix_and_direction_variants():
    candidate = match_photo_candidate(raw_candidate(), ADDRESS)
    assert candidate is not None
    assert candidate.provider == 'Zillow'
    assert candidate.source_page_url == ZILLOW
    assert candidate.remote_image_url.endswith('/front.jpg')
    assert candidate.property_identity == '2256 fallen tree drive e|jacksonville|fl|32246'


def test_match_photo_candidate_rejects_nearby_prefix_unit_and_untrusted_results():
    rows = [
        raw_candidate(title='225 Fallen Tree Dr E, Jacksonville, FL 32246',
                      url=ZILLOW.replace('2256-', '225-')),
        raw_candidate(title='22560 Fallen Tree Dr E, Jacksonville, FL 32246',
                      url=ZILLOW.replace('2256-', '22560-')),
        raw_candidate(title='2256 Fallen Tree Dr E Unit 2, Jacksonville, FL 32246',
                      url=ZILLOW.replace('/44605347_', '/unit-2_')),
        raw_candidate(url='https://example.com/2256-fallen-tree-dr-e',
                      title='2256 Fallen Tree Dr E, Jacksonville, FL 32246'),
    ]
    assert all(match_photo_candidate(row, ADDRESS) is None for row in rows)


def test_rank_photo_candidates_deduplicates_and_prefers_provider_diversity():
    now = datetime.now(timezone.utc)
    def candidate(number, provider, image, confidence=90):
        return PhotoCandidate(
            candidate_id=f'candidate-{number}', property_identity='home', provider=provider,
            source_page_url=f'https://{provider.lower()}.example/home/{number}',
            remote_image_url=image, photo_kind_hint='exterior', width=1200, height=800,
            match_confidence=confidence, match_evidence={'exact_address': True},
            created_at=now, expires_at=now + timedelta(minutes=30))

    ranked = rank_photo_candidates([
        candidate(1, 'Zillow', 'https://img.example/a.jpg', 99),
        candidate(2, 'Zillow', 'https://img.example/b.jpg', 98),
        candidate(3, 'Redfin', 'https://img.example/c.jpg', 90),
        candidate(4, 'Realtor.com', 'https://img.example/a.jpg', 95),
    ], limit=3)
    assert [item.provider for item in ranked] == ['Zillow', 'Redfin', 'Zillow']
    assert len({item.remote_image_url for item in ranked}) == 3


def test_rank_photo_candidates_enforces_twelve_item_limit():
    now = datetime.now(timezone.utc)
    candidates = [PhotoCandidate(
        candidate_id=f'id-{index}', property_identity='home', provider='Zillow',
        source_page_url=f'https://www.zillow.com/home/{index}',
        remote_image_url=f'https://photos.zillowstatic.com/{index}.jpg',
        photo_kind_hint='', width=900, height=600, match_confidence=80,
        match_evidence={}, created_at=now, expires_at=now + timedelta(hours=1))
        for index in range(20)]
    assert len(rank_photo_candidates(candidates)) == 12


def test_candidate_database_record_contains_metadata_but_no_image_blob_column():
    columns = set(models.PropertyPhotoCandidateRecord.__table__.columns.keys())
    assert {'id', 'property_identity', 'provider', 'source_page_url', 'remote_image_url',
            'photo_kind_hint', 'width', 'height', 'match_confidence', 'match_evidence',
            'created_at', 'expires_at'} <= columns
    assert not ({'image', 'image_bytes', 'blob', 'data'} & columns)


def test_candidates_from_search_reads_row_and_top_level_images_and_rejects_neighbor():
    data = {
        'rows': [raw_candidate(imageUrl='https://photos.zillowstatic.com/fp/row.jpg')],
        'images': [
            raw_candidate(imageUrl='https://photos.zillowstatic.com/fp/top.jpg'),
            raw_candidate(title='2258 Fallen Tree Dr E, Jacksonville, FL 32246',
                          url=ZILLOW.replace('2256-', '2258-'),
                          imageUrl='https://photos.zillowstatic.com/fp/neighbor.jpg'),
        ],
    }
    candidates = candidates_from_search(data, ADDRESS)
    assert {item.remote_image_url for item in candidates} == {
        'https://photos.zillowstatic.com/fp/row.jpg',
        'https://photos.zillowstatic.com/fp/top.jpg',
    }
    assert all(item.candidate_id and item.expires_at > item.created_at for item in candidates)


@pytest.fixture
def api_engine(monkeypatch):
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False},
                           poolclass=StaticPool)
    Base.metadata.create_all(engine)
    return engine


def test_discover_api_stores_metadata_only_and_returns_safe_candidates(api_engine, monkeypatch):
    engine = api_engine
    candidate = match_photo_candidate(raw_candidate(), ADDRESS)
    monkeypatch.setattr(router, 'get_settings', lambda: SimpleNamespace(crawl4ai_api_key='key'))
    def found(address, settings):
        assert address == ADDRESS
        return [candidate]
    monkeypatch.setattr(router, 'discover_photo_candidates', found)
    with Session(engine) as db:
        response = router.discover(router.DiscoverRequest(address=ADDRESS), db)
    assert response.status_code == 200
    assert response.headers['cache-control'] == 'private, no-store'
    payload = json.loads(response.body)
    assert len(payload['candidates']) == 1
    assert set(payload['candidates'][0]) == {
        'id', 'provider', 'sourcePageUrl', 'kind', 'width', 'height', 'previewUrl'}
    assert 'zillowstatic' not in response.body.decode()
    with Session(engine) as db:
        record = db.scalar(select(models.PropertyPhotoCandidateRecord))
        assert record.remote_image_url.endswith('/front.jpg')
        assert not hasattr(record, 'image_bytes')


def test_discover_api_degrades_to_empty_when_provider_fails(api_engine, monkeypatch):
    def unavailable(*_):
        return []
    monkeypatch.setattr(router, 'discover_photo_candidates', unavailable)
    with Session(api_engine) as db:
        response = router.discover(router.DiscoverRequest(address=ADDRESS), db)
    assert response.status_code == 200
    assert json.loads(response.body)['candidates'] == []


def test_discovery_provider_uses_normalized_listing_query(monkeypatch):
    class Response:
        def raise_for_status(self): pass
        def json(self): return {'images': [raw_candidate()]}
    def post(_client, url, headers, json):
        assert url.endswith('/tools/search')
        assert headers['Authorization'] == 'Bearer key'
        assert json['q'].startswith('"2256 Fallen Tree Dr E, Jacksonville, FL 32246"')
        return Response()
    monkeypatch.setattr(httpx.Client, 'post', post)
    candidates = router.discover_photo_candidates(
        ADDRESS, SimpleNamespace(crawl4ai_api_key='key'))
    assert len(candidates) == 1
    assert candidates[0].provider == 'Zillow'
