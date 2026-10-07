from fastapi import APIRouter, Query

from app.help_guide import faq_entries, guide_entries, search_guide

router = APIRouter(prefix="/api/help", tags=["help"])


@router.get("/guide")
async def help_guide() -> dict:
    return {"faqs": faq_entries(), "topics": guide_entries()}


@router.get("/search")
async def help_search(q: str = Query(default="", max_length=160)) -> dict:
    return {"results": search_guide(q)}
