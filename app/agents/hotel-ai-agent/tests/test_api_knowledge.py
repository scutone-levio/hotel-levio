from fastapi.testclient import TestClient

import app as app_module
import knowledge
from knowledge import Citation, KnowledgeAnswer

client = TestClient(app_module.api)


def test_returns_503_when_store_missing(monkeypatch):
    monkeypatch.setattr(knowledge, "load_store", lambda: None)
    resp = client.post("/api/knowledge", json={"question": "refund policy?"})
    assert resp.status_code == 503
    assert resp.json()["detail"] == "Knowledge base not ingested."


def test_returns_answer_and_citations(monkeypatch):
    monkeypatch.setattr(knowledge, "load_store", lambda: object())
    monkeypatch.setattr(
        knowledge,
        "answer",
        lambda question, *, store, model: KnowledgeAnswer(
            answer="Cancel free up to 24h before check-in.",
            citations=[Citation(source="policies.pdf", page=4, snippet="Cancel free…")],
            found=True,
        ),
    )
    resp = client.post("/api/knowledge", json={"question": "cancellation policy?"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["found"] is True
    assert body["answer"].startswith("Cancel free")
    assert body["citations"][0] == {"source": "policies.pdf", "page": 4, "snippet": "Cancel free…"}
