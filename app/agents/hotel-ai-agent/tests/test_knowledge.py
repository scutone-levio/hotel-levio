from langchain_core.documents import Document

import knowledge
from knowledge import (
    Citation,
    Passage,
    build_prompt,
    chunk_pages,
    select_relevant,
    _snippet,
)


def test_chunk_pages_splits_with_overlap_and_metadata():
    text = "a" * 1000
    docs = chunk_pages([(3, text)], source="policies.pdf", chunk_size=800, overlap=150)
    assert len(docs) == 2
    assert all(isinstance(d, Document) for d in docs)
    assert docs[0].metadata == {"source": "policies.pdf", "page": 3}
    assert len(docs[0].page_content) == 800
    # second chunk starts at 800 - 150 = 650, so it is 350 chars long
    assert len(docs[1].page_content) == 350


def test_chunk_pages_terminates_when_overlap_ge_chunk_size():
    # overlap >= chunk_size must not infinite-loop; it should still chunk and terminate
    docs = chunk_pages([(1, "a" * 1000)], source="p.pdf", chunk_size=100, overlap=200)
    assert len(docs) >= 1
    assert all(d.metadata["page"] == 1 for d in docs)


def test_chunk_pages_normalizes_whitespace_and_skips_blank_pages():
    docs = chunk_pages([(1, "  hello\n\n  world  "), (2, "   ")], source="p.pdf")
    assert len(docs) == 1
    assert docs[0].page_content == "hello world"
    assert docs[0].metadata["page"] == 1


def test_select_relevant_keeps_only_scores_at_or_above_threshold():
    passages = [
        Passage("a", "p.pdf", 1, 0.9),
        Passage("b", "p.pdf", 2, 0.2),
        Passage("c", "p.pdf", 3, 0.1),
    ]
    kept = select_relevant(passages, min_score=0.2)
    assert [p.page for p in kept] == [1, 2]


def test_build_prompt_includes_passages_and_grounding_rule():
    prompt = build_prompt("What is the refund policy?", [Passage("Refunds within 24h.", "p.pdf", 5, 0.8)])
    assert "Refunds within 24h." in prompt
    assert "p.pdf" in prompt and "5" in prompt
    assert "only" in prompt.lower()  # grounding instruction present


def test_snippet_truncates_long_text():
    assert _snippet("x" * 300, limit=240).startswith("x" * 240)
    assert len(_snippet("x" * 300, limit=240)) <= 241  # allow trailing ellipsis
