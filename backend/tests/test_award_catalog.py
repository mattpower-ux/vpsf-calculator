import copy
import json
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import Session

from app.db import Base, get_db
from app.models import ProductRecord, ProductAdviceRecord
from app.repositories import seed_products, list_products
from app.routers.products import router


@pytest.fixture
def manifest(tmp_path, monkeypatch):
    from app.products import award_catalog
    data = dict(schemaVersion=1, catalogVersion='test-awards-v1', sources=[{'title': 'Awards', 'url': 'https://example.com/awards'}], products=[dict(
        id='test-award', brand='Test Brand', product='Test Product', pillar='Water', category='Fixtures',
        summary='This example product helps homeowners evaluate water saving fixtures for their homes while providing a practical option to discuss with an installer before choosing compatible equipment and installation details.',
        imageUrl='/catalog-images/test.webp', companyUrl='https://example.com/product',
        awards=[dict(year=2026, sourceUrl='https://example.com/awards', sourceTitle='Awards')],
        imageCredit='Manufacturer', imageSourceUrl='https://example.com/image', needTags=['fixtures'], pillars=['water'], requirements=['fixture-fit'])])
    path = tmp_path / 'awards.json'
    path.write_text(json.dumps(data), encoding='utf-8')
    monkeypatch.setattr(award_catalog, 'MANIFEST_PATH', path)
    return path, data


@pytest.fixture
def engine(tmp_path):
    engine = create_engine('sqlite:///' + str(tmp_path / 'catalog.db'), connect_args={'check_same_thread': False})
    Base.metadata.create_all(engine)
    yield engine
    engine.dispose()


def test_import_is_persistent_idempotent_and_uses_manifest_metadata(engine, manifest):
    from app.models import ProductCatalogSourceRecord
    with Session(engine) as db:
        seed_products(db)
        p = next(p for p in list_products(db) if p.id == 'test-award')
        assert (p.weight, p.needTags, p.companyUrl, p.catalogVersion) == ('Standard', ['fixtures'], 'https://example.com/product', 'test-awards-v1')
        assert p.awards[0].year == 2026
        assert db.get(ProductRecord, p.id).source_year == 2026
        assert len(db.scalars(select(ProductCatalogSourceRecord)).all()) == 1
    writes = []
    def capture(conn, cursor, statement, parameters, context, executemany):
        if statement.lstrip().upper().startswith(('INSERT', 'UPDATE', 'DELETE')): writes.append(statement)
    event.listen(engine, 'before_cursor_execute', capture)
    with Session(engine) as db:
        seed_products(db)
    assert writes == []
    manifest[0].unlink()
    with Session(engine) as db:
        assert next(p for p in list_products(db) if p.id == 'test-award').catalogVersion == 'test-awards-v1'


def test_existing_admin_content_hidden_status_and_metadata_survive(engine, manifest):
    with Session(engine) as db:
        db.add(ProductRecord(id='test-award', brand='Custom', product='Custom', pillar='Water', category='Fixtures', weight='Hidden', status='inactive', summary='Admin copy', image_url='https://example.com/custom'))
        db.add(ProductAdviceRecord(id='test-award', payload={'needTags': ['leaks'], 'pillars': ['water'], 'requirements': [], 'isSponsored': True, 'sponsorName': 'Custom'}, revision=7))
        db.commit()
        seed_products(db)
        record = db.get(ProductRecord, 'test-award')
        assert (record.weight, record.status, record.summary, record.image_url) == ('Hidden', 'inactive', 'Admin copy', 'https://example.com/custom')
        assert db.get(ProductAdviceRecord, record.id).revision == 7
        record.status = 'active'
        db.commit()
        p = next(p for p in list_products(db) if p.id == record.id)
        assert p.needTags == ['leaks'] and p.sponsorName == 'Custom'
        hardie = next(p for p in list_products(db) if p.id == 'james-hardie-plank')
        assert hardie.isSponsored and hardie.sponsorName == 'James Hardie'


@pytest.mark.parametrize('change', ['duplicate', 'alias', 'url', 'image', 'summary', 'pillar', 'tags', 'requirements', 'version'])
def test_invalid_manifest_rejected_atomically(engine, manifest, change):
    path, data = manifest
    p = data['products'][0]
    if change == 'duplicate': data['products'].append(copy.deepcopy(p))
    elif change == 'alias':
        other = copy.deepcopy(p); other['id'] = 'alias'; other['existingId'] = p['id']; data['products'].append(other)
    elif change == 'url': p['companyUrl'] = 'javascript:alert(1)'
    elif change == 'image': p['imageUrl'] = '//evil.example/image'
    elif change == 'summary': p['summary'] = 'Too short'
    elif change == 'pillar': p['pillar'] = 'Unknown'
    elif change == 'tags': p['needTags'] = ['unsupported-tag']
    elif change == 'requirements': p['requirements'] = ['unsupported-requirement']
    else: data['schemaVersion'] = 2
    path.write_text(json.dumps(data), encoding='utf-8')
    with Session(engine) as db:
        with pytest.raises(ValueError): seed_products(db)
        assert db.scalars(select(ProductRecord)).all() == []


def test_public_export_excludes_hidden_inactive_and_private_metadata(engine, manifest):
    app = FastAPI(); app.include_router(router)
    def session():
        with Session(engine) as db: yield db
    app.dependency_overrides[get_db] = session
    with Session(engine) as db:
        seed_products(db)
        db.get(ProductRecord, 'james-hardie-plank').weight = 'Hidden'
        db.get(ProductRecord, 'test-award').technical_writeup = 'PRIVATE ADMIN NOTE'
        db.add(ProductRecord(id='inactive', brand='Private', product='Private', pillar='Water', category='Fixtures', status='inactive'))
        db.commit()
    response = TestClient(app).get('/api/products/catalog')
    assert response.status_code == 200
    payload = response.json()
    assert payload['catalogVersion'] == 'test-awards-v1'
    ids = {p['id'] for p in payload['products']}
    assert 'test-award' in ids and not {'james-hardie-plank', 'inactive'} & ids
    assert 'PRIVATE' not in response.text and 'technical_writeup' not in response.text


def test_concurrent_imports_do_not_duplicate_or_fail(engine, manifest):
    def run(_):
        with Session(engine) as db: seed_products(db)
    with ThreadPoolExecutor(max_workers=4) as pool: list(pool.map(run, range(8)))
    with Session(engine) as db:
        assert len(db.scalars(select(ProductRecord).where(ProductRecord.id == 'test-award')).all()) == 1

def test_alias_enriches_legacy_seed_without_changing_priority_or_sponsorship(engine, manifest):
    path, data = manifest
    data['products'][0]['existingId'] = 'james-hardie-plank'
    path.write_text(json.dumps(data), encoding='utf-8')
    with Session(engine) as db:
        seed_products(db)
        hardie = next(p for p in list_products(db) if p.id == 'james-hardie-plank')
        assert hardie.summary == data['products'][0]['summary']
        assert hardie.imageUrl == 'https://vpsf-calculator.onrender.com/catalog-images/test.webp'
        assert hardie.isSponsored and hardie.sponsorName == 'James Hardie'
        assert db.get(ProductRecord, 'test-award') is None
        db.get(ProductRecord, hardie.id).weight = 'Priority'
        db.commit()
        seed_products(db)
        assert db.get(ProductRecord, hardie.id).weight == 'Priority'


def test_version_history_is_immutable_and_updates_defaults_only(engine, manifest):
    from app.models import ProductCatalogSourceRecord
    path, data = manifest
    with Session(engine) as db:
        seed_products(db)
        data['products'][0]['needTags'] = ['leaks']
        path.write_text(json.dumps(data), encoding='utf-8')
        with pytest.raises(ValueError, match='catalogVersion'): seed_products(db)
        assert len(db.scalars(select(ProductCatalogSourceRecord)).all()) == 1
        data['catalogVersion'] = 'test-awards-v2'
        path.write_text(json.dumps(data), encoding='utf-8')
        seed_products(db)
        assert len(db.scalars(select(ProductCatalogSourceRecord)).all()) == 2
        p = next(p for p in list_products(db) if p.id == 'test-award')
        assert p.needTags == ['leaks'] and p.catalogVersion == 'test-awards-v2'


def test_failure_rolls_back_source_and_all_seed_products(engine, manifest):
    from app.models import ProductCatalogSourceRecord
    def fail_on_award(conn, cursor, statement, parameters, context, executemany):
        if statement.startswith('INSERT INTO products') and 'test-award' in parameters:
            raise RuntimeError('Simulated storage failure')
    event.listen(engine, 'before_cursor_execute', fail_on_award)
    with Session(engine) as db:
        with pytest.raises(RuntimeError, match='storage failure'): seed_products(db)
        assert db.scalars(select(ProductRecord)).all() == []
        assert db.scalars(select(ProductCatalogSourceRecord)).all() == []

def test_award_model_name_upgrades_only_unchanged_legacy_name(engine, manifest):
    from app.products.catalog import SEED_PRODUCTS
    path, data = manifest
    original = next(p for p in SEED_PRODUCTS if p.id == 'rachio-smart-irrigation')
    data['products'][0]['existingId'] = original.id
    path.write_text(json.dumps(data), encoding='utf-8')
    with Session(engine) as db:
        seed_products(db)
        record = db.get(ProductRecord, original.id)
        assert record.product == 'Test Product'
        record.product = 'Admin custom model'
        db.commit()
        data['catalogVersion'] = 'test-awards-v2'
        data['products'][0]['product'] = 'New award model'
        path.write_text(json.dumps(data), encoding='utf-8')
        seed_products(db)
        assert db.get(ProductRecord, original.id).product == 'Admin custom model'

@pytest.mark.parametrize('admin_field', [None, 'product', 'summary', 'image_url', 'product_url', 'source_year', 'source_issue', 'tags'])
def test_new_version_corrects_untouched_imports_and_preserves_admin_fields(engine, manifest, admin_field):
    path, data = manifest
    with Session(engine) as db:
        seed_products(db)
        record = db.get(ProductRecord, 'test-award')
        admin_values = dict(product='Admin model', summary='Admin summary', image_url='',
                            product_url='https://example.com/admin', source_year=2024,
                            source_issue='Admin issue', tags=[])
        if admin_field:
            setattr(record, admin_field, admin_values[admin_field])
        record.weight = 'Hidden'
        record.status = 'inactive'
        db.add(ProductAdviceRecord(id='test-award', payload={'needTags': ['heating']}, revision=3))
        db.commit()
        data['catalogVersion'] = 'test-awards-v2'
        product = data['products'][0]
        product.update(product='Corrected model', summary=product['summary'].replace('example', 'corrected'),
                       imageUrl='/catalog-images/corrected.webp', companyUrl='https://example.com/corrected',
                       needTags=['leaks'], awards=[dict(year=2025, sourceUrl='https://example.com/corrected-awards', sourceTitle='Corrected issue')])
        path.write_text(json.dumps(data), encoding='utf-8')
        seed_products(db)
        db.refresh(record)
        expected = dict(product='Corrected model', summary=product['summary'], image_url='/catalog-images/corrected.webp',
                        product_url='https://example.com/corrected', source_year=2025, source_issue='Corrected issue', tags=['leaks'])
        if admin_field:
            expected[admin_field] = admin_values[admin_field]
        assert {field: getattr(record, field) for field in expected} == expected
        assert (record.weight, record.status) == ('Hidden', 'inactive')
        assert db.get(ProductAdviceRecord, record.id).payload == {'needTags': ['heating']}
        assert db.get(ProductAdviceRecord, record.id).revision == 3
        # Compare v3 to v2, not the first import or the newly inserted source.
        data['catalogVersion'] = 'test-awards-v3'
        product['companyUrl'] = 'https://example.com/third'
        path.write_text(json.dumps(data), encoding='utf-8')
        seed_products(db)
        db.refresh(record)
        assert record.product_url == (admin_values['product_url'] if admin_field == 'product_url' else 'https://example.com/third')
