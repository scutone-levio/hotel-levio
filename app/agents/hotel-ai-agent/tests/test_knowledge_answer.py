from langchain_core.documents import Document

from knowledge import NOT_FOUND_MESSAGE, answer


class FakeStore:
    def __init__(self, results):
        self._results = results

    def similarity_search_with_relevance_scores(self, query, k=4):
        return self._results[:k]


class FakeModel:
    def __init__(self):
        self.prompts = []

    def invoke(self, prompt):
        self.prompts.append(prompt)
        return "  Guests may cancel free up to 24h before check-in.  "


def _doc(text, page):
    return Document(page_content=text, metadata={"source": "policies.pdf", "page": page})


def test_answer_returns_grounded_answer_with_citations():
    store = FakeStore([(_doc("Cancel free up to 24h before check-in.", 4), 0.82)])
    model = FakeModel()
    result = answer("What is the cancellation policy?", store=store, model=model, min_score=0.2)
    assert result.found is True
    assert result.answer == "Guests may cancel free up to 24h before check-in."
    assert len(result.citations) == 1
    assert result.citations[0].source == "policies.pdf"
    assert result.citations[0].page == 4
    assert model.prompts, "model should have been invoked"


def test_answer_returns_not_found_when_below_threshold_without_calling_model():
    store = FakeStore([(_doc("Breakfast is 7-10am.", 9), 0.05)])
    model = FakeModel()
    result = answer("What is the pet policy?", store=store, model=model, min_score=0.2)
    assert result.found is False
    assert result.answer == NOT_FOUND_MESSAGE
    assert result.citations == []
    assert model.prompts == [], "model must NOT be called when nothing is relevant"


def test_answer_dedupes_citations_by_source_and_page():
    # Two relevant passages from the same source+page must yield one citation.
    store = FakeStore(
        [
            (_doc("Cancel free up to 24h before check-in.", 4), 0.82),
            (_doc("A no-show is charged the full amount.", 4), 0.71),
        ]
    )
    model = FakeModel()
    result = answer("cancellation policy?", store=store, model=model, min_score=0.2)
    assert result.found is True
    assert len(result.citations) == 1
    assert result.citations[0].source == "policies.pdf"
    assert result.citations[0].page == 4
