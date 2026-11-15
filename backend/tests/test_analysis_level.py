import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.db import Base, get_db
from app.models import PropertyRecord, ScoreRunRecord, PropertyDetailArchiveRecord
from app.schemas import PropertyInput, ScoreResponse
from app.routers import scoring, demos, tracking
from app.scoring.store import seed_published


@pytest.fixture
def app_client():
    engine=create_engine('sqlite://',connect_args={'check_same_thread':False},poolclass=StaticPool)
    Base.metadata.create_all(engine)
    with Session(engine) as db: seed_published(db)
    app=FastAPI()
    def database():
        with Session(engine) as db: yield db
    app.dependency_overrides[get_db]=database
    app.include_router(scoring.router); app.include_router(demos.router); app.include_router(tracking.router)
    with TestClient(app) as client: yield client,engine
    engine.dispose()


def test_omitted_level_defaults_moderate_for_old_inputs_and_outputs():
    assert PropertyInput.model_validate({'address':'Old saved home'}).analysisLevel=='moderate'
    response=ScoreResponse(scores={},total=0,grade='D',label='Test',meaning='Test',modelVersion='old')
    assert response.analysisLevel=='moderate'
    for invalid in ['Broad','unknown','',None,1]:
        with pytest.raises(ValidationError): PropertyInput(analysisLevel=invalid)


def test_levels_persist_and_return_without_changing_scores(app_client):
    client,engine=app_client
    outputs=[]
    for level in ['broad','moderate','inclusive']:
        response=client.post('/api/score',json={'address':'Metadata test home','analysisLevel':level,'hvac':'Heat Pump (Electric)'})
        assert response.status_code==200,response.text
        body=response.json(); assert body['analysisLevel']==level
        outputs.append({key:body[key] for key in ['scores','total','grade','confidence','explanations','improvements']})
        with Session(engine) as db:
            home=db.get(PropertyRecord,body['propertyId'])
            run=db.get(ScoreRunRecord,body['scoreRunId'])
            assert home.input_snapshot['analysisLevel']==level
            assert run.input_snapshot['analysisLevel']==level
            assert PropertyInput.model_validate(run.input_snapshot).analysisLevel==level
    assert outputs[0]==outputs[1]==outputs[2]
    old=client.post('/api/score',json={'address':'Old client'}).json()
    assert old['analysisLevel']=='moderate'


def test_demo_score_preserves_level(app_client):
    client,_=app_client
    response=client.post('/api/demos/hardie-wildfire/score',json={'demoScenario':'hardie-wildfire','analysisLevel':'inclusive'})
    assert response.status_code==200,response.text
    assert response.json()['analysisLevel']=='inclusive'


def test_saved_property_and_detail_archive_retain_level(app_client):
    client,engine=app_client
    home={'address':'123 Metadata Road','analysisLevel':'broad'}
    first=client.post('/api/tracking/property-query',json={'sessionId':'level-test','address':home['address'],'snapshot':home})
    assert first.status_code==200
    changed={**home,'analysisLevel':'inclusive'}
    progress=client.post('/api/tracking/progress',json={'sessionId':'level-test','queryId':first.json()['id'],'screen':1,'screenLabel':'House Details','snapshot':changed,'detailChanges':[{'field':'analysisLevel','previousValue':'broad','newValue':'inclusive'}]})
    assert progress.status_code==200,progress.text
    saved=client.get('/api/tracking/saved-property',params={'address':home['address']}).json()
    assert saved['property']['latestSnapshot']['analysisLevel']=='inclusive'
    with Session(engine) as db:
        archive=db.scalar(select(PropertyDetailArchiveRecord).where(PropertyDetailArchiveRecord.query_id==first.json()['id']))
        assert archive.snapshot['analysisLevel']=='inclusive'


def test_level_is_metadata_not_an_available_scoring_field():
    from app.routers.admin import scoring_available_fields
    assert 'analysisLevel' not in scoring_available_fields()
