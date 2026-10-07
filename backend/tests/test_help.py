from app.help_guide import faq_entries, guide_entries, search_guide
from app.main import app


def test_help_guide_has_five_faqs_and_detailed_topics():
    assert len(faq_entries()) == 5
    assert len(guide_entries()) >= 12
    assert faq_entries()[0]["question"] == "What is Value Per Square Foot?"
    assert faq_entries()[1]["question"] == "How does the VPSF calculator work?"
    assert faq_entries()[4]["question"] == "Do you guarantee performance increases?"
    assert "saved-property" not in {entry["id"] for entry in faq_entries()}
    products = faq_entries()[2]
    assert "best products" in products["question"].lower()
    assert products["screen"] == 7
    assert all(topic["body"] for topic in guide_entries())
    assert {"/api/help/guide", "/api/help/search"}.issubset({route.path for route in app.routes})


def test_help_search_ranks_relevant_guide_answers():
    assert search_guide("How does the calculator work?")[0]["id"] == "calculator-workflow"
    assert search_guide("saved property rescanning API pull")[0]["id"] == "saved-property"
    assert search_guide("guarantee performance increases")[0]["id"] == "performance-guarantee"
    assert search_guide("") == []
