from app.help_guide import faq_entries, guide_entries, search_guide
from app.main import app


def get_help_response(path, **kwargs):
    import asyncio
    import httpx

    async def request():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            return await client.get(path, **kwargs)

    return asyncio.run(request())


def test_help_guide_preserves_original_faqs_and_adds_certification_help():
    assert len(faq_entries()) >= 6
    assert len(guide_entries()) >= 12
    assert faq_entries()[0]["question"] == "What is Value Per Square Foot?"
    assert faq_entries()[1]["question"] == "How does the VPSF calculator work?"
    assert faq_entries()[4]["question"] == "Do you guarantee performance increases?"
    assert "saved-property" not in {entry["id"] for entry in guide_entries()}
    products = faq_entries()[2]
    assert "best products" in products["question"].lower()
    assert products["screen"] == 7
    assert all(topic["body"] for topic in guide_entries())
    pillars = next(topic for topic in guide_entries() if topic["id"] == "seven-pillars")
    assert [section["heading"] for section in pillars["sections"][:7]] == [
        "Energy", "Water", "Health", "Resilience", "Carbon & Materials", "Financial Risk", "Community & Mobility"
    ]
    assert "general definitions" in pillars["sections"][-1]["text"]
    assert "My Scores" in pillars["sections"][-1]["text"]
    assert get_help_response("/api/help/search", params={"q": ""}).json() == {"results": []}


def test_help_search_ranks_relevant_guide_answers():
    assert search_guide("How does the calculator work?")[0]["id"] == "calculator-workflow"
    assert "saved-property" not in {entry["id"] for entry in search_guide("saved property rescanning API pull")}
    assert search_guide("guarantee performance increases")[0]["id"] == "performance-guarantee"
    assert search_guide("") == []


def test_help_search_indexes_scannable_point_text():
    assert search_guide("recheck")[0]["id"] == "recommendations"


def test_help_api_exposes_certification_faq_and_separate_manual_chapter():
    response = get_help_response("/api/help/guide")
    assert response.status_code == 200
    guide = response.json()
    assert any(entry["id"] == "certification-scoring" for entry in guide["faqs"])
    chapter = next(entry for entry in guide["topics"] if entry["id"] == "certification-evidence")
    assert not chapter.get("faq")
    assert chapter["screen"] == 3
    assert "exact edition" in str(chapter).lower()
    assert "scorecard" in str(chapter).lower()


def test_help_api_search_discovers_current_workflow_and_certification_limits():
    cases = [
        ("Basic Informed Superior", "analysis-levels", ["Basic", "Informed", "Superior"]),
        ("PermitStack", "address-and-records", ["completed work", "equipment age"]),
        ("PROCESS", "evidence-and-documents", ["PROCESS", "review", "Read documents"]),
        ("certification points", "certification-scoring", ["missing", "ordinary", "blanket"]),
        ("LEED NGBS scorecard", "certification-evidence", ["optional", "scorecard"]),
        ("WaterSense fixtures", "certification-mappings", ["v2", "toilets", "showerheads"]),
        ("explicit correction", "certification-corrections", ["No/None", "replaced"]),
        ("historical reports", "historical-reports", ["unchanged"]),
        ("manufacturer inquiries", "manufacturer-inquiries", ["administrator", "not automatically sent"]),
    ]
    for query, expected, terms in cases:
        response = get_help_response("/api/help/search", params={"q": query})
        assert response.status_code == 200
        results = response.json()["results"]
        entry = next((entry for entry in results if entry["id"] == expected), None)
        assert entry is not None, query
        content = " ".join([entry["body"], *[f"{section['heading']} {section['text']}" for section in entry["sections"]]])
        for term in terms:
            assert term.lower() in content.lower(), (query, term)


def test_program_catalog_search_covers_all_eight_families_without_promising_scores():
    for program in ["WaterSense", "ENERGY STAR", "Indoor AirPlus", "LEED", "NGBS", "Phius", "Passive House Institute", "FORTIFIED", "Wildfire Prepared Home"]:
        results = search_guide(program)
        catalog = next((entry for entry in results if entry["id"] == "certification-programs"), None)
        assert catalog is not None, program
        assert "not automatic scoring" in catalog["body"].lower()
