from app.help_guide import search_guide


def test_search_finds_text_in_scannable_guide_points():
    assert search_guide("recheck")[0]["id"] == "recommendations"
