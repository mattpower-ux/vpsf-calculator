from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app.demo_hardie import hardie_demo_home
from app.schemas import PropertyInput, ScoreResponse
from app.scoring.store import load_published
from app.scoring.catalog import evaluate_model
from app.scoring import classify_score, explain_score, confidence_for_input
from app.scoring.improvements import improvement_plan
from app.routers.scoring import validate_extra_inputs, prepare_scoring_evidence

router=APIRouter(prefix="/api/demos",tags=["demonstrations"])

@router.get("/hardie-wildfire")
def hardie_home():
    return {"home":hardie_demo_home().model_dump(mode="json")}

@router.post("/hardie-wildfire/score",response_model=ScoreResponse)
async def hardie_score(home:PropertyInput,db:Session=Depends(get_db)):
    if home.demoScenario != "hardie-wildfire":
        raise HTTPException(422,"This endpoint is only for the presentation profile.")
    model=load_published(db)
    try: validate_extra_inputs(home.extraInputs,model)
    except ValueError as e: raise HTTPException(422,str(e)) from e
    await prepare_scoring_evidence(home, model, db)
    scores=evaluate_model(home,model)
    total=sum(scores.values())
    return ScoreResponse(walkability=home.epaWalkability,scores=scores,total=total,modelVersion=model.version,explanations=explain_score(home,scores),confidence=confidence_for_input(home),improvements=improvement_plan(home,model),**classify_score(total))
