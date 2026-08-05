"""Policy knowledge base: document-RAG core (chunking, retrieval, answering)."""

from __future__ import annotations

import os
from dataclasses import dataclass

from langchain_core.documents import Document

CHUNK_SIZE = int(os.getenv("KB_CHUNK_SIZE", "800"))
CHUNK_OVERLAP = int(os.getenv("KB_CHUNK_OVERLAP", "150"))
KB_TOP_K = int(os.getenv("KB_TOP_K", "4"))
KB_MIN_SCORE = float(os.getenv("KB_MIN_SCORE", "0.2"))
_HERE = os.path.dirname(os.path.abspath(__file__))
KB_STORE_DIR = os.getenv("KB_STORE_DIR", os.path.join(_HERE, "kb_store"))
KB_DATA_DIR = os.getenv("KB_DATA_DIR", os.path.join(_HERE, "data", "policies"))
COLLECTION = "hotel_policies"

NOT_FOUND_MESSAGE = "I couldn't find that in the policy documents."


@dataclass(frozen=True)
class Passage:
    text: str
    source: str
    page: int
    score: float


@dataclass(frozen=True)
class Citation:
    source: str
    page: int
    snippet: str


@dataclass(frozen=True)
class KnowledgeAnswer:
    answer: str
    citations: list[Citation]
    found: bool


def chunk_pages(
    pages: list[tuple[int, str]],
    source: str,
    chunk_size: int = CHUNK_SIZE,
    overlap: int = CHUNK_OVERLAP,
) -> list[Document]:
    docs: list[Document] = []
    for page_num, raw in pages:
        text = " ".join(raw.split())
        if not text:
            continue
        start = 0
        while start < len(text):
            end = start + chunk_size
            chunk = text[start:end]
            if chunk.strip():
                docs.append(
                    Document(page_content=chunk, metadata={"source": source, "page": page_num})
                )
            if end >= len(text):
                break
            start = end - overlap
    return docs


def select_relevant(passages: list[Passage], min_score: float = KB_MIN_SCORE) -> list[Passage]:
    return [p for p in passages if p.score >= min_score]


def _snippet(text: str, limit: int = 240) -> str:
    text = " ".join(text.split())
    if len(text) <= limit:
        return text
    return text[:limit] + "…"


def build_prompt(question: str, passages: list[Passage]) -> str:
    context = "\n\n".join(
        f"[{i + 1}] (source: {p.source}, page: {p.page})\n{p.text}"
        for i, p in enumerate(passages)
    )
    return (
        "You are a hotel operations assistant. Answer the admin's question using "
        "ONLY the policy excerpts below. If the excerpts do not contain the answer, "
        "say you could not find it. Cite the source and page you used.\n\n"
        f"Policy excerpts:\n{context}\n\n"
        f"Question: {question}\n"
        "Answer:"
    )
