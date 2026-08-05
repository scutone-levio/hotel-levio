import math

from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings

import knowledge
from knowledge import build_store, load_store, retrieve


class HashEmbeddings(Embeddings):
    """Deterministic offline embeddings so store tests need no Ollama."""

    def __init__(self, dim: int = 24) -> None:
        self.dim = dim

    def _embed(self, text: str) -> list[float]:
        vec = [0.0] * self.dim
        for i, ch in enumerate(text.lower()):
            vec[i % self.dim] += ord(ch)
        norm = math.sqrt(sum(v * v for v in vec)) or 1.0
        return [v / norm for v in vec]

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [self._embed(t) for t in texts]

    def embed_query(self, text: str) -> list[float]:
        return self._embed(text)


def test_load_store_returns_none_before_build(tmp_path):
    assert load_store(persist_dir=str(tmp_path / "empty"), embeddings=HashEmbeddings()) is None


def test_build_then_retrieve_returns_matching_passage(tmp_path):
    emb = HashEmbeddings()
    docs = [
        Document(page_content="Guests may cancel free of charge up to 24 hours before check-in.",
                 metadata={"source": "policies.pdf", "page": 4}),
        Document(page_content="Breakfast is served from 7am to 10am in the main hall.",
                 metadata={"source": "policies.pdf", "page": 9}),
    ]
    persist = str(tmp_path / "kb")
    build_store(docs, persist_dir=persist, embeddings=emb)

    store = load_store(persist_dir=persist, embeddings=emb)
    assert store is not None

    passages = retrieve(store, "cancellation charge before check-in", k=2)
    assert passages, "expected at least one passage"
    top = passages[0]
    assert top.source == "policies.pdf"
    assert top.page == 4
    assert isinstance(top.score, float)
