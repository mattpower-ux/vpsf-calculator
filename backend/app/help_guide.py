import json
import re
from collections import defaultdict
from pathlib import Path

_GUIDE_PATH = Path(__file__).parent / "data" / "help_guide.json"
_TOPICS = json.loads(_GUIDE_PATH.read_text(encoding="utf-8"))
_STOP_WORDS = {"a", "an", "and", "are", "can", "does", "for", "get", "how", "i", "in", "is", "my", "of", "on", "the", "to", "what", "where", "will"}


def _tokens(value: str) -> set[str]:
    return {token for token in re.findall(r"[a-z0-9]+", value.lower()) if token not in _STOP_WORDS}


_INDEX: dict[str, dict[int, int]] = defaultdict(dict)
for position, topic in enumerate(_TOPICS):
    fields = ((topic["title"], 6), (topic.get("question", ""), 6), (" ".join(topic["keywords"]), 4), (topic["body"], 1))
    for content, weight in fields:
        for token in _tokens(content):
            _INDEX[token][position] = _INDEX[token].get(position, 0) + weight


def guide_entries() -> list[dict]:
    return _TOPICS


def faq_entries() -> list[dict]:
    return [topic for topic in _TOPICS if topic.get("faq")]


def search_guide(query: str, limit: int = 8) -> list[dict]:
    terms = _tokens(query[:160])
    if not terms:
        return []
    scores: dict[int, int] = defaultdict(int)
    for term in terms:
        for position, weight in _INDEX.get(term, {}).items():
            scores[position] += weight
    ranked = sorted(scores, key=lambda position: (-scores[position], position))
    return [_TOPICS[position] for position in ranked[:limit]]
