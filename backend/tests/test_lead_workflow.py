import csv
from io import StringIO
from datetime import timedelta

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.db import Base, get_db, ensure_lead_schema
from app.models import LeadRecord, ProductRecord, utc_now
from app.routers import leads, admin


@pytest.fixture
def setup(monkeypatch):
    monkeypatch.setenv('ADMIN_PASSWORD', 'lead-tests-only')
    engine = create_engine('sqlite://', connect_args={'check_same_thread':False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        for id, brand, maker in [('test-one','Brand One','Maker One'),('test-two','Brand Two','Maker Two')]:
            db.add(ProductRecord(id=id, brand=brand, manufacturer=maker, product='Product '+id, pillar='Energy', category='Test', weight='Standard', summary='Test'))
        db.commit()
    app = FastAPI()
    def database():
        with Session(engine) as db: yield db
    app.dependency_overrides[get_db] = database
    app.include_router(leads.router); app.include_router(admin.router)
    with TestClient(app) as client:
        token = client.post('/api/admin/session', json={'password':'lead-tests-only'}).json()['token']
        yield client, engine, {'Authorization':'Bearer '+token}
    engine.dispose()


def payload(**changes):
    return {'name':'Example Person','email':'person@example.com','productId':'test-one','contactConsent':True, 'zip':'80201', 'role':'homeowner', **changes}


def test_canonical_record_duplicate_and_context(setup):
    client, engine, headers = setup
    data = payload(brand='Spoof', manufacturer='Spoof', assessmentContext={'sidingType':'Wood','resilienceScore':30,'reason':'Visible siding'}, scope='Replace siding', shareConsent=True)
    first = client.post('/api/leads',json=data)
    assert first.status_code == 200
    assert client.post('/api/leads',json=data).json() == first.json()
    report = client.get('/api/admin/reports/leads',headers=headers).json()
    assert report['total'] == 1
    row = report['rows'][0]
    assert row['manufacturer'] == 'Maker One'
    assert row['productName'] == 'Brand One Product test-one'
    assert row['assessmentContext'] == data['assessmentContext']
    assert row['status'] == 'new' and row['revision'] == 1
    assert row['contactConsent'] is True and row['shareConsent'] is True
    with Session(engine) as db:
        record = db.get(LeadRecord, first.json()['id'])
        record.created_at = utc_now() - timedelta(hours=25)
        db.commit()
    assert client.post('/api/leads',json=data).json()['id'] != first.json()['id']


@pytest.mark.parametrize('change', [{'name':''},{'email':'not-email'},{'email':'a\n@example.com'},{'productId':''},{'productId':'unknown'}, {'contactConsent':False},{'contactConsent':'true'}, {'scope':'x'*501},{'phone':'x'*41},{'intent':'spam'},{'timeline':'tomorrow'}, {'assessmentContext':{'secret':'no'}}, {'assessmentContext':{'totalScore':True}}, {'assessmentContext':{'reason':{'nested':'no'}}}])
def test_invalid_submission_rejected(setup, change):
    client,_,_ = setup
    assert client.post('/api/leads',json=payload(**change)).status_code == 422


def test_required_fields_and_auth(setup):
    client,_,_ = setup
    for field in ['name','email','productId','contactConsent','zip']:
        data = payload(); data.pop(field)
        assert client.post('/api/leads',json=data).status_code == 422
    for path in ['/api/admin/reports/leads','/api/admin/reports/leads/export']:
        assert client.get(path).status_code == 401
    assert client.patch('/api/admin/leads/1',json={'status':'reviewed','adminNotes':'','revision':1}).status_code == 401


def test_counts_untruncated_filters_dates_and_pagination(setup):
    client,engine,headers = setup
    with Session(engine) as db:
        for i in range(507):
            db.add(LeadRecord(name='Person',email=f'{i}@example.com', product_id='test-one', manufacturer='Maker One', product_name='Product test-one',status='new',contact_consent=True,is_demo=False))
        db.add(LeadRecord(name='Demo',product_id='test-two',manufacturer='Maker Two',is_demo=True,status='reviewed'))
        db.add(LeadRecord(name='Old',product_id='test-two',manufacturer='Maker Two',created_at=utc_now()-timedelta(days=60),status='qualified'))
        db.commit()
    body = client.get('/api/admin/reports/leads?page=2&pageSize=7',headers=headers).json()
    assert body['total'] == 508 and len(body['rows']) == 7 and body['page'] == 2
    assert body['byStatus'] == {'new':507,'qualified':1}
    assert body['byManufacturer']['Maker One'] == 507
    assert body['byProduct']['test-one'] == 507
    assert client.get('/api/admin/reports/leads?manufacturer=Maker%20One&productId=test-one&status=new',headers=headers).json()['total']==507
    assert client.get('/api/admin/reports/leads?includeDemo=true',headers=headers).json()['total']==509
    today=utc_now().date().isoformat()
    assert client.get('/api/admin/reports/leads',params={'dateFrom':today,'dateTo':today},headers=headers).json()['total']==507
    assert client.get('/api/admin/reports/leads?dateFrom=2026-12-01&dateTo=2026-01-01',headers=headers).status_code==422
    assert client.get('/api/admin/reports/leads?pageSize=1000',headers=headers).status_code==422


def test_lifecycle_optimistic_lock_and_consent_guard(setup):
    client,_,headers=setup
    id=client.post('/api/leads',json=payload()).json()['id']
    def patch(status,revision=1): return client.patch(f'/api/admin/leads/{id}',json={'status':status,'adminNotes':'Reviewed manually','revision':revision},headers=headers)
    assert patch('approved').status_code==422
    assert patch('reviewed').json()['revision']==2
    assert patch('qualified').status_code==409
    assert patch('qualified',2).status_code==200
    real=client.post('/api/leads',json=payload(email='real@example.com',shareConsent=True)).json()['id']
    demo=client.post('/api/leads',json=payload(email='demo@example.com',shareConsent=True,isDemo=True)).json()['id']
    for lead_id,expected in [(real,200),(demo,422)]:
        response=client.patch(f'/api/admin/leads/{lead_id}',json={'status':'approved','adminNotes':'Approved for review only','revision':1},headers=headers)
        assert response.status_code==expected
    for revision,status in enumerate(['contacted','quoted','won','lost','archived'],start=2):
        assert client.patch(f'/api/admin/leads/{real}',json={'status':status,'adminNotes':'Manual status','revision':revision},headers=headers).status_code==200


def test_export_all_filtered_rows_and_formula_safety(setup):
    client,engine,headers=setup
    with Session(engine) as db:
        for i in range(105):
            db.add(LeadRecord(name=' =HYPERLINK("evil")',email=f'{i}@example.com',phone='+1234',product_id='test-one',manufacturer='Maker One',admin_notes='\t=1+1'))
        db.add(LeadRecord(name='Hidden demo',is_demo=True))
        db.commit()
    response=client.get('/api/admin/reports/leads/export?pageSize=1',headers=headers)
    assert response.status_code==200 and response.headers['cache-control']=='no-store'
    rows=list(csv.DictReader(StringIO(response.text)))
    assert len(rows)==105
    assert rows[0]['name'].startswith("'") and rows[0]['phone'].startswith("'") and rows[0]['adminNotes'].startswith("'")


def test_migration_preserves_legacy_record_and_unknown_consent(tmp_path):
    engine=create_engine('sqlite:///'+str(tmp_path/'legacy.db'))
    with engine.begin() as conn:
        conn.execute(text('CREATE TABLE leads (id INTEGER PRIMARY KEY, name VARCHAR(255), email VARCHAR(255), role VARCHAR(120), product_id VARCHAR(120), property_id INTEGER, property_address VARCHAR(255), zip VARCHAR(20), action VARCHAR(120), created_at DATETIME)'))
        conn.execute(text("INSERT INTO leads (id,name,email,action,created_at) VALUES (42,'Legacy','legacy@example.com','Requested info','2020-01-02 00:00:00')"))
    ensure_lead_schema(engine); ensure_lead_schema(engine)
    with Session(engine) as db:
        row=db.get(LeadRecord,42)
        assert row.name=='Legacy' and row.email=='legacy@example.com'
        assert row.contact_consent is None and row.share_consent is None
        assert row.status=='new' and row.revision==1 and row.updated_at==row.created_at
    engine.dispose()


def test_public_rate_limit(setup):
    client,_,_=setup
    for _ in range(10): assert client.post('/api/leads',json=payload()).status_code==200
    response=client.post('/api/leads',json=payload())
    assert response.status_code==429 and 'Retry-After' in response.headers


def test_internal_contact_does_not_require_sharing_consent(setup):
    client,_,headers=setup
    lead_id=client.post('/api/leads',json=payload()).json()['id']
    response=client.patch(f'/api/admin/leads/{lead_id}',json={'status':'contacted','adminNotes':'VPSF team contacted with permission','revision':1},headers=headers)
    assert response.status_code==200 and response.json()['shareConsent'] is False
    assert client.patch(f'/api/admin/leads/{lead_id}',json={'status':'quoted','adminNotes':'','revision':2},headers=headers).status_code==422


def test_legacy_manufacturer_fallback_and_stored_unknown_manufacturer(setup):
    client,engine,headers=setup
    with Session(engine) as db:
        db.add(LeadRecord(name='Legacy catalog', product_id='test-one', contact_consent=None, share_consent=None))
        db.add(LeadRecord(name='Legacy removed', product_id='removed-product', manufacturer='Historical Maker',product_name='Historical Full Name'))
        db.commit()
    report=client.get('/api/admin/reports/leads',headers=headers).json()
    assert report['byManufacturer']=={'Maker One':1,'Historical Maker':1}
    legacy=next(row for row in report['rows'] if row['productId']=='test-one')
    assert legacy['productName']=='Brand One Product test-one'
    assert legacy['contactConsent'] is None
    assert client.patch(f"/api/admin/leads/{legacy['id']}",json={'status':'approved','adminNotes':'','revision':1},headers=headers).status_code==422
    filtered=client.get('/api/admin/reports/leads',params={'manufacturer':'Historical Maker'},headers=headers).json()
    assert filtered['total']==1 and filtered['rows'][0]['productName']=='Historical Full Name'


@pytest.mark.parametrize('zip_code', ['1234','123456','12345-123','letters'])
def test_required_zip_format(setup, zip_code):
    client,_,_=setup
    assert client.post('/api/leads',json=payload(zip=zip_code)).status_code==422


def test_zip_plus_four_role_and_notes_bounds(setup):
    client,_,headers=setup
    response=client.post('/api/leads',json=payload(zip='01234-5678',role='designer'))
    assert response.status_code==200
    assert client.post('/api/leads',json=payload(role='invented')).status_code==422
    assert client.patch(f"/api/admin/leads/{response.json()['id']}",json={'status':'reviewed','adminNotes':'x'*2001,'revision':1},headers=headers).status_code==422


def test_concurrent_exact_retries_save_one_record(tmp_path):
    from concurrent.futures import ThreadPoolExecutor
    from app.lead_schemas import LeadRequest
    from app.lead_workflow import create_lead
    engine=create_engine('sqlite:///'+str(tmp_path/'retries.db'),connect_args={'check_same_thread':False})
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        db.add(ProductRecord(id='test-one',brand='Brand',manufacturer='Maker',product='Model',pillar='Energy',category='Test',weight='Standard',summary='Test'))
        db.commit()
    def submit(_):
        with Session(engine) as db: return create_lead(db,LeadRequest(**payload())).id
    with ThreadPoolExecutor(max_workers=4) as pool:
        ids=list(pool.map(submit,range(8)))
    assert len(set(ids))==1
    with Session(engine) as db: assert len(db.scalars(select(LeadRecord)).all())==1
    engine.dispose()


def test_postgres_additive_column_definitions():
    from sqlalchemy.dialects import postgresql
    from sqlalchemy.schema import CreateColumn
    dialect=postgresql.dialect()
    definitions={column.name:str(CreateColumn(column).compile(dialect=dialect)) for column in LeadRecord.__table__.columns}
    assert 'BOOLEAN DEFAULT false NOT NULL' in definitions['is_demo']
    assert 'TIMESTAMP WITH TIME ZONE' in definitions['updated_at']
    assert 'JSON' in definitions['assessment_context']
    assert 'DEFAULT' not in definitions['contact_consent']
    assert 'DEFAULT' not in definitions['share_consent']


def test_context_limits_and_no_email_existence_response(setup):
    client,_,_=setup
    for context in [{'reason':'x'*501}, {'totalScore':10**1000}, {'photo':'data:image/jpeg;base64,private'}, {'reason':['private']}]:
        assert client.post('/api/leads',json=payload(assessmentContext=context)).status_code==422
    accepted=client.post('/api/leads',json=payload()).json()
    changed=client.post('/api/leads',json=payload(scope='Different legitimate request')).json()
    assert set(accepted)==set(changed)=={'id','status'}
    assert accepted['status']==changed['status']=='accepted'


def test_unknown_manufacturer_counts_are_not_overwritten(setup):
    client,engine,headers=setup
    with Session(engine) as db:
        db.add(LeadRecord(name='Missing manufacturer'))
        db.add(LeadRecord(name='Stored Unknown',manufacturer='Unknown'))
        db.commit()
    body=client.get('/api/admin/reports/leads',headers=headers).json()
    assert body['total']==2 and body['byManufacturer']=={'Unknown':2}


def test_safe_csv_unicode_space_and_bom():
    from app.routers.admin_leads import safe_cell
    for text in ['=1+1','+123','-1+2','@SUM(A1)', '\ufeff =1+1', '\u2003=1+1', '\t=1+1']:
        assert safe_cell(text).startswith("'")
    assert safe_cell('Plain name')=='Plain name'


def test_nul_text_rejected_before_database(setup):
    client,_,headers=setup
    assert client.post('/api/leads',json=payload(scope='Bad\x00scope')).status_code==422
    id=client.post('/api/leads',json=payload()).json()['id']
    assert client.patch(f'/api/admin/leads/{id}',json={'status':'reviewed','adminNotes':'Bad\x00notes','revision':1},headers=headers).status_code==422


def test_render_backup_precedes_lead_columns_and_is_not_overwritten(tmp_path, monkeypatch):
    import sqlite3
    monkeypatch.setenv('RENDER', 'true')
    path=tmp_path/'production-test.db'
    engine=create_engine('sqlite:///'+str(path))
    with engine.begin() as conn:
        conn.execute(text('CREATE TABLE leads (id INTEGER PRIMARY KEY, name VARCHAR(255), email VARCHAR(255), role VARCHAR(120), product_id VARCHAR(120), property_id INTEGER, property_address VARCHAR(255), zip VARCHAR(20), action VARCHAR(120), created_at DATETIME)'))
        conn.execute(text("INSERT INTO leads (id,name,email,action,created_at) VALUES (42,'Keep me','legacy@example.com','Requested info','2020-01-02 00:00:00')"))
    ensure_lead_schema(engine)
    backup=tmp_path/'vpsf-before-leads-2026-11-15.sqlite.bak'
    assert backup.exists()
    original=backup.read_bytes()
    with sqlite3.connect(str(backup)) as connection:
        assert connection.execute('SELECT name FROM leads WHERE id=42').fetchone()[0]=='Keep me'
        assert 'contact_consent' not in {row[1] for row in connection.execute('PRAGMA table_info(leads)')}
    with Session(engine) as db:
        row=db.get(LeadRecord,42); assert row.contact_consent is None
        row.name='Changed after migration'; db.commit()
    ensure_lead_schema(engine)
    assert backup.read_bytes()==original
    engine.dispose()


def test_fresh_volume_does_not_create_legacy_backup(tmp_path, monkeypatch):
    monkeypatch.setenv('RENDER', 'true')
    engine=create_engine('sqlite:///'+str(tmp_path/'fresh.db'))
    Base.metadata.create_all(engine)
    ensure_lead_schema(engine)
    assert not (tmp_path/'vpsf-before-leads-2026-11-15.sqlite.bak').exists()
    engine.dispose()
