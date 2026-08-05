# Admin Policy Knowledge Base (RAG) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give hotel admins a searchable knowledge base that answers hotel-policy questions from ingested policy PDFs, with grounded, cited answers.

**Architecture:** A document-RAG pipeline runs inside the existing Python bridge (FastAPI + LangChain + Ollama): an offline CLI ingests local PDFs into a persisted Chroma vector index using Ollama embeddings; a `POST /api/knowledge` endpoint retrieves top-k passages and has `llama3` answer strictly from them. Next.js exposes an admin-gated proxy route and a `/admin/knowledge` ("Policy Search") page.

**Tech Stack:** Python 3.14, FastAPI, LangChain (`langchain-ollama`, `langchain-chroma`), Chroma, `pypdf`, Ollama (`nomic-embed-text` embeddings, `llama3` generation); Next.js 15 App Router, NextAuth v5, TypeScript; pytest + `tsx --test` + Playwright.

## Global Constraints

Every task's requirements implicitly include these:

- Server routes return `{ ok: true; ... } | { ok: false; error: string }` and never throw to the client.
- `/api/admin/knowledge` MUST call `auth()` and reject non-`ADMIN` (401 if no user, 403 if not admin) — middleware does **not** cover `/api/*`.
- Grounding guardrail: the model answers only from retrieved passages. When no passage clears the score threshold, return the fixed string `"I couldn't find that in the policy documents."` with `found=false` and do **not** call the LLM.
- No Kaggle anywhere; no `KAGGLE_*` env vars.
- Corpus PDFs (`app/agents/hotel-ai-agent/data/policies/`) and the index (`app/agents/hotel-ai-agent/kb_store/`) are gitignored — never committed.
- Reuse `getAgentBridgeUrl()` and `AGENT_BRIDGE_TIMEOUT_MS` from `lib/concierge/agent-bridge.ts`; bridge base defaults to `http://127.0.0.1:8000`.
- Embeddings model: Ollama `nomic-embed-text`. Generation model: the existing `llama3` `OllamaLLM` instance in `app.py`.
- Chroma collection name: `hotel_policies`. Config defaults: `KB_TOP_K=4`, `KB_CHUNK_SIZE=800`, `KB_CHUNK_OVERLAP=150`, `KB_MIN_SCORE=0.2`, read from env with those fallbacks.
- `npm run lint` must stay clean. Python tests run with `pytest`; TS unit tests run with `tsx --test`.

## File Structure

**Python bridge (`app/agents/hotel-ai-agent/`)**
- `knowledge.py` (new) — RAG core: config, dataclasses, chunking, PDF extraction, store build/load, retrieval, prompt, answer orchestration.
- `ingest_kb.py` (new) — offline CLI: discover PDFs → extract → chunk → build store.
- `app.py` (modify) — add `POST /api/knowledge` endpoint + Pydantic models; import `knowledge`.
- `requirements.txt` (modify) — add `pypdf`, `chromadb`, `langchain-chroma`.
- `requirements-dev.txt` (new) — `pytest`, `httpx`.
- `data/policies/.gitkeep`, `data/policies/README.md` (new) — where admins drop PDFs.
- `tests/test_knowledge.py`, `tests/test_ingest.py`, `tests/test_api_knowledge.py` (new, under the agent dir) — pytest suites.

**Next.js**
- `lib/concierge/knowledge-bridge.ts` (new) — bridge types + fetch mapping.
- `lib/concierge/knowledge-bridge.test.ts` (new) — `tsx --test` unit test.
- `app/api/admin/knowledge/route.ts` (new) — admin-gated proxy.
- `app/admin/knowledge/page.tsx` (new) — server shell.
- `components/admin/knowledge-panel.tsx` (new) — client Q&A UI.
- `components/admin/admin-nav-items.ts` (modify) — add "Policy Search" nav entry.
- `tests/admin-knowledge.spec.ts` (new) — Playwright gate test.

**Docs / config**
- `.gitignore` (modify) — ignore `data/policies/` and `kb_store/`.
- `CLAUDE.md` (modify) — knowledge-base setup steps.
- `package.json` (modify) — add the new TS unit test file to `test:unit`.

**Testing note (reconciliation with spec):** The spec described a single authenticated-admin Playwright test. No admin-auth e2e fixture or deterministic seed password exists in this repo, so an authenticated admin browser test would be brittle. This plan instead covers the required behaviors with: (a) Python unit tests for retrieval, grounding/not-found, and the 503-when-not-ingested path; (b) a TS unit test for the bridge's error/success mapping (the "degrades gracefully" behavior); and (c) a deterministic Playwright test asserting `/admin/knowledge` is gated (unauthenticated → redirect to `/login`). Authenticated-admin UI e2e is left as a follow-up once an admin-session fixture exists.

---

### Task 1: Config scaffold — dependencies, gitignore, data folder

**Files:**
- Modify: `app/agents/hotel-ai-agent/requirements.txt`
- Create: `app/agents/hotel-ai-agent/requirements-dev.txt`
- Create: `app/agents/hotel-ai-agent/data/policies/.gitkeep`
- Create: `app/agents/hotel-ai-agent/data/policies/README.md`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: nothing.
- Produces: an installable venv with `pypdf`, `chromadb`, `langchain-chroma`, `pytest`, `httpx`; gitignored corpus/index directories.

- [ ] **Step 1: Install the new dependencies into the existing venv**

```bash
cd app/agents/hotel-ai-agent
source venv/bin/activate
pip install pypdf chromadb langchain-chroma
pip install pytest httpx
```

- [ ] **Step 2: Pin the installed versions into requirements files**

Append runtime deps to `requirements.txt` and write dev deps to `requirements-dev.txt`, pinned to whatever actually installed:

```bash
pip freeze | grep -iE "^(pypdf|chromadb|langchain-chroma)==" >> requirements.txt
pip freeze | grep -iE "^(pytest|httpx)==" > requirements-dev.txt
```

- [ ] **Step 3: Create the corpus folder and its docs**

`app/agents/hotel-ai-agent/data/policies/.gitkeep`: empty file.

`app/agents/hotel-ai-agent/data/policies/README.md`:

```markdown
# Policy documents

Drop hotel policy & procedure PDFs here, then build the index:

    cd app/agents/hotel-ai-agent
    source venv/bin/activate
    python ingest_kb.py

PDFs in this folder and the generated `../kb_store/` index are gitignored and
never committed.
```

- [ ] **Step 4: Gitignore the corpus and index**

Add to `.gitignore` (under the existing "Python (agent bridge)" section):

```gitignore
# Policy knowledge base (corpus + vector index)
app/agents/hotel-ai-agent/data/policies/*
!app/agents/hotel-ai-agent/data/policies/.gitkeep
!app/agents/hotel-ai-agent/data/policies/README.md
app/agents/hotel-ai-agent/kb_store/
```

- [ ] **Step 5: Verify deps import and ignores hold**

```bash
python -c "import pypdf, chromadb, langchain_chroma; print('deps OK')"
git check-ignore app/agents/hotel-ai-agent/kb_store/x app/agents/hotel-ai-agent/data/policies/test.pdf
```
Expected: `deps OK`; both paths echoed back (ignored). The `.gitkeep`/`README.md` are NOT ignored.

- [ ] **Step 6: Commit**

```bash
git add .gitignore app/agents/hotel-ai-agent/requirements.txt app/agents/hotel-ai-agent/requirements-dev.txt app/agents/hotel-ai-agent/data/policies/.gitkeep app/agents/hotel-ai-agent/data/policies/README.md
git commit -m "chore: scaffold policy KB deps, corpus folder, and gitignore"
```

---

### Task 2: Pure RAG helpers — chunking, prompt, relevance filter

**Files:**
- Create: `app/agents/hotel-ai-agent/knowledge.py`
- Test: `app/agents/hotel-ai-agent/tests/test_knowledge.py`

**Interfaces:**
- Consumes: `langchain_core.documents.Document`.
- Produces:
  - `Passage` dataclass: `text: str, source: str, page: int, score: float`.
  - `Citation` dataclass: `source: str, page: int, snippet: str`.
  - `KnowledgeAnswer` dataclass: `answer: str, citations: list[Citation], found: bool`.
  - `NOT_FOUND_MESSAGE: str`.
  - `chunk_pages(pages: list[tuple[int, str]], source: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[Document]`.
  - `build_prompt(question: str, passages: list[Passage]) -> str`.
  - `select_relevant(passages: list[Passage], min_score: float = KB_MIN_SCORE) -> list[Passage]`.
  - `_snippet(text: str, limit: int = 240) -> str`.
  - Config constants: `CHUNK_SIZE, CHUNK_OVERLAP, KB_TOP_K, KB_MIN_SCORE, KB_STORE_DIR, KB_DATA_DIR, COLLECTION`.

- [ ] **Step 1: Write the failing tests**

`app/agents/hotel-ai-agent/tests/test_knowledge.py`:

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app/agents/hotel-ai-agent && source venv/bin/activate && python -m pytest tests/test_knowledge.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'knowledge'`.

- [ ] **Step 3: Write the minimal implementation**

`app/agents/hotel-ai-agent/knowledge.py`:

```python
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app/agents/hotel-ai-agent && source venv/bin/activate && python -m pytest tests/test_knowledge.py -v`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add app/agents/hotel-ai-agent/knowledge.py app/agents/hotel-ai-agent/tests/test_knowledge.py
git commit -m "feat: add policy KB chunking, prompt, and relevance helpers"
```

---

### Task 3: Vector store — build, load, retrieve (Chroma)

**Files:**
- Modify: `app/agents/hotel-ai-agent/knowledge.py`
- Test: `app/agents/hotel-ai-agent/tests/test_knowledge_store.py`

**Interfaces:**
- Consumes: `Passage`, `COLLECTION`, `KB_STORE_DIR`, `KB_TOP_K` from Task 2.
- Produces:
  - `default_embeddings() -> OllamaEmbeddings`.
  - `iter_pdf_pages(path: str) -> list[tuple[int, str]]` (1-indexed pages, blank pages skipped).
  - `build_store(docs: list[Document], persist_dir: str = KB_STORE_DIR, embeddings=None) -> Chroma`.
  - `load_store(persist_dir: str = KB_STORE_DIR, embeddings=None) -> Chroma | None` (None if not built).
  - `retrieve(store, query: str, k: int = KB_TOP_K) -> list[Passage]` — uses `store.similarity_search_with_relevance_scores(query, k=k)`.

- [ ] **Step 1: Write the failing tests**

`app/agents/hotel-ai-agent/tests/test_knowledge_store.py`:

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app/agents/hotel-ai-agent && source venv/bin/activate && python -m pytest tests/test_knowledge_store.py -v`
Expected: FAIL — `ImportError: cannot import name 'build_store'`.

- [ ] **Step 3: Add the store functions to `knowledge.py`**

Add these imports at the top of `knowledge.py`:

```python
from langchain_chroma import Chroma
from langchain_ollama import OllamaEmbeddings
from pypdf import PdfReader
```

Append these functions:

```python
def default_embeddings() -> OllamaEmbeddings:
    return OllamaEmbeddings(model=os.getenv("KB_EMBED_MODEL", "nomic-embed-text"))


def iter_pdf_pages(path: str) -> list[tuple[int, str]]:
    reader = PdfReader(path)
    pages: list[tuple[int, str]] = []
    for index, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        if text.strip():
            pages.append((index + 1, text))
    return pages


def build_store(docs, persist_dir: str = KB_STORE_DIR, embeddings=None) -> Chroma:
    store = Chroma(
        collection_name=COLLECTION,
        embedding_function=embeddings or default_embeddings(),
        persist_directory=persist_dir,
    )
    if docs:
        store.add_documents(docs)
    return store


def load_store(persist_dir: str = KB_STORE_DIR, embeddings=None):
    if not os.path.exists(os.path.join(persist_dir, "chroma.sqlite3")):
        return None
    return Chroma(
        collection_name=COLLECTION,
        embedding_function=embeddings or default_embeddings(),
        persist_directory=persist_dir,
    )


def retrieve(store, query: str, k: int = KB_TOP_K) -> list[Passage]:
    results = store.similarity_search_with_relevance_scores(query, k=k)
    return [
        Passage(
            text=doc.page_content,
            source=str(doc.metadata.get("source", "")),
            page=int(doc.metadata.get("page", 0)),
            score=float(score),
        )
        for doc, score in results
    ]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app/agents/hotel-ai-agent && source venv/bin/activate && python -m pytest tests/test_knowledge_store.py -v`
Expected: PASS (2 tests). (If Chroma warns about relevance-score range, the test still passes — it asserts ordering/metadata, not exact scores.)

- [ ] **Step 5: Commit**

```bash
git add app/agents/hotel-ai-agent/knowledge.py app/agents/hotel-ai-agent/tests/test_knowledge_store.py
git commit -m "feat: add Chroma build/load/retrieve to policy KB"
```

---

### Task 4: Answer orchestration — grounded generation + not-found

**Files:**
- Modify: `app/agents/hotel-ai-agent/knowledge.py`
- Test: `app/agents/hotel-ai-agent/tests/test_knowledge_answer.py`

**Interfaces:**
- Consumes: `retrieve`, `select_relevant`, `build_prompt`, `_snippet`, `Passage`, `Citation`, `KnowledgeAnswer`, `NOT_FOUND_MESSAGE`, `KB_TOP_K`, `KB_MIN_SCORE`.
- Produces: `answer(question: str, *, store, model, k: int = KB_TOP_K, min_score: float = KB_MIN_SCORE) -> KnowledgeAnswer`. `store` must expose `similarity_search_with_relevance_scores(query, k)`; `model` must expose `invoke(prompt) -> str`.

- [ ] **Step 1: Write the failing tests**

`app/agents/hotel-ai-agent/tests/test_knowledge_answer.py`:

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app/agents/hotel-ai-agent && source venv/bin/activate && python -m pytest tests/test_knowledge_answer.py -v`
Expected: FAIL — `ImportError: cannot import name 'answer'`.

- [ ] **Step 3: Add `answer()` to `knowledge.py`**

```python
def answer(question, *, store, model, k=KB_TOP_K, min_score=KB_MIN_SCORE) -> KnowledgeAnswer:
    passages = retrieve(store, question, k=k)
    relevant = select_relevant(passages, min_score=min_score)
    if not relevant:
        return KnowledgeAnswer(answer=NOT_FOUND_MESSAGE, citations=[], found=False)
    prompt = build_prompt(question, relevant)
    text = str(model.invoke(prompt)).strip()
    citations = [Citation(source=p.source, page=p.page, snippet=_snippet(p.text)) for p in relevant]
    return KnowledgeAnswer(answer=text, citations=citations, found=True)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app/agents/hotel-ai-agent && source venv/bin/activate && python -m pytest tests/ -v`
Expected: PASS (all knowledge tests green).

- [ ] **Step 5: Commit**

```bash
git add app/agents/hotel-ai-agent/knowledge.py app/agents/hotel-ai-agent/tests/test_knowledge_answer.py
git commit -m "feat: add grounded answer orchestration with not-found guardrail"
```

---

### Task 5: Ingestion CLI (`ingest_kb.py`)

**Files:**
- Create: `app/agents/hotel-ai-agent/ingest_kb.py`
- Test: `app/agents/hotel-ai-agent/tests/test_ingest.py`

**Interfaces:**
- Consumes: `iter_pdf_pages`, `chunk_pages`, `build_store`, `KB_DATA_DIR`, `KB_STORE_DIR` from `knowledge`.
- Produces: `discover_pdfs(data_dir: str = KB_DATA_DIR) -> list[str]` (sorted absolute paths); `main() -> int` (0 on success, 1 on failure).

- [ ] **Step 1: Write the failing tests**

`app/agents/hotel-ai-agent/tests/test_ingest.py`:

```python
import ingest_kb


def test_discover_pdfs_finds_only_pdfs_sorted(tmp_path):
    (tmp_path / "b.pdf").write_bytes(b"%PDF-1.4")
    (tmp_path / "a.pdf").write_bytes(b"%PDF-1.4")
    (tmp_path / "notes.txt").write_text("ignore me")
    found = ingest_kb.discover_pdfs(str(tmp_path))
    assert [p.rsplit("/", 1)[-1] for p in found] == ["a.pdf", "b.pdf"]


def test_main_returns_1_when_no_pdfs(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(ingest_kb.knowledge, "KB_DATA_DIR", str(tmp_path))
    monkeypatch.setattr(ingest_kb, "discover_pdfs", lambda data_dir=str(tmp_path): [])
    assert ingest_kb.main() == 1
    assert "No PDFs" in capsys.readouterr().out


def test_main_builds_store_from_extracted_pages(tmp_path, monkeypatch, capsys):
    calls = {}
    monkeypatch.setattr(ingest_kb, "discover_pdfs", lambda data_dir=None: ["/x/policies.pdf"])
    monkeypatch.setattr(ingest_kb.knowledge, "iter_pdf_pages", lambda path: [(1, "Cancel up to 24h before check-in.")])
    monkeypatch.setattr(ingest_kb.knowledge, "KB_STORE_DIR", str(tmp_path / "kb"))

    def fake_build(docs, persist_dir=None, embeddings=None):
        calls["docs"] = docs
        return object()

    monkeypatch.setattr(ingest_kb.knowledge, "build_store", fake_build)
    assert ingest_kb.main() == 0
    assert len(calls["docs"]) == 1
    assert calls["docs"][0].metadata["source"] == "policies.pdf"
    assert "1 chunk" in capsys.readouterr().out
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app/agents/hotel-ai-agent && source venv/bin/activate && python -m pytest tests/test_ingest.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'ingest_kb'`.

- [ ] **Step 3: Write `ingest_kb.py`**

```python
"""Offline CLI: build the policy knowledge base index from local PDFs."""

from __future__ import annotations

import os
import shutil
import sys

import knowledge


def discover_pdfs(data_dir: str = knowledge.KB_DATA_DIR) -> list[str]:
    if not os.path.isdir(data_dir):
        return []
    names = [n for n in os.listdir(data_dir) if n.lower().endswith(".pdf")]
    return [os.path.join(data_dir, n) for n in sorted(names)]


def main() -> int:
    pdfs = discover_pdfs()
    if not pdfs:
        print(f"No PDFs found in {knowledge.KB_DATA_DIR}. Add policy PDFs and retry.")
        return 1

    if os.path.isdir(knowledge.KB_STORE_DIR):
        shutil.rmtree(knowledge.KB_STORE_DIR)

    all_docs = []
    for path in pdfs:
        pages = knowledge.iter_pdf_pages(path)
        docs = knowledge.chunk_pages(pages, source=os.path.basename(path))
        all_docs.extend(docs)
        print(f"  {os.path.basename(path)}: {len(pages)} pages -> {len(docs)} chunks")

    if not all_docs:
        print("No extractable text found in the PDFs.")
        return 1

    knowledge.build_store(all_docs)
    print(f"Ingested {len(pdfs)} file(s), {len(all_docs)} chunk(s) into {knowledge.KB_STORE_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app/agents/hotel-ai-agent && source venv/bin/activate && python -m pytest tests/test_ingest.py -v`
Expected: PASS (3 tests).

- [ ] **Step 5: Manual end-to-end verification (documented, requires Ollama + a real PDF)**

```bash
# with Ollama running and nomic-embed-text pulled, and a PDF in data/policies/
python ingest_kb.py
```
Expected: prints per-file chunk counts and a final "Ingested … chunk(s)" line; `kb_store/chroma.sqlite3` exists.

- [ ] **Step 6: Commit**

```bash
git add app/agents/hotel-ai-agent/ingest_kb.py app/agents/hotel-ai-agent/tests/test_ingest.py
git commit -m "feat: add policy KB ingestion CLI"
```

---

### Task 6: FastAPI endpoint `POST /api/knowledge`

**Files:**
- Modify: `app/agents/hotel-ai-agent/app.py`
- Test: `app/agents/hotel-ai-agent/tests/test_api_knowledge.py`

**Interfaces:**
- Consumes: `knowledge.load_store`, `knowledge.answer`, and the existing module-level `model` (`OllamaLLM`) in `app.py`.
- Produces: `POST /api/knowledge` accepting `{ "question": str }`, returning `{ "answer": str, "citations": [{source, page, snippet}], "found": bool }`, or **503** `{ "detail": "Knowledge base not ingested." }` when no index exists.

- [ ] **Step 1: Write the failing test**

`app/agents/hotel-ai-agent/tests/test_api_knowledge.py`:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app/agents/hotel-ai-agent && source venv/bin/activate && python -m pytest tests/test_api_knowledge.py -v`
Expected: FAIL — 404 on `/api/knowledge` (route not defined).

- [ ] **Step 3: Add the endpoint to `app.py`**

Add `import knowledge` near the other imports. Then add, next to the existing `handle_chat` route:

```python
class KnowledgeQuery(BaseModel):
    question: str


class CitationOut(BaseModel):
    source: str
    page: int
    snippet: str


class KnowledgeResponse(BaseModel):
    answer: str
    citations: List[CitationOut]
    found: bool


@api.post("/api/knowledge", response_model=KnowledgeResponse)
async def handle_knowledge(payload: KnowledgeQuery):
    store = knowledge.load_store()
    if store is None:
        raise HTTPException(status_code=503, detail="Knowledge base not ingested.")
    result = knowledge.answer(payload.question, store=store, model=model)
    return KnowledgeResponse(
        answer=result.answer,
        citations=[CitationOut(source=c.source, page=c.page, snippet=c.snippet) for c in result.citations],
        found=result.found,
    )
```

(`HTTPException`, `BaseModel`, `List`, and `model` are already imported/defined in `app.py`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app/agents/hotel-ai-agent && source venv/bin/activate && python -m pytest tests/ -v`
Expected: PASS (all Python tests green).

- [ ] **Step 5: Commit**

```bash
git add app/agents/hotel-ai-agent/app.py app/agents/hotel-ai-agent/tests/test_api_knowledge.py
git commit -m "feat: add /api/knowledge bridge endpoint"
```

---

### Task 7: TS bridge client `knowledge-bridge.ts`

**Files:**
- Create: `lib/concierge/knowledge-bridge.ts`
- Test: `lib/concierge/knowledge-bridge.test.ts`
- Modify: `package.json` (add the test file to `test:unit`)

**Interfaces:**
- Consumes: `getAgentBridgeUrl`, `AGENT_BRIDGE_TIMEOUT_MS` from `lib/concierge/agent-bridge.ts`.
- Produces:
  - `type KnowledgeCitation = { source: string; page: number; snippet: string }`.
  - `type KnowledgeAnswer = { answer: string; citations: KnowledgeCitation[]; found: boolean }`.
  - `type KnowledgeResult = { ok: true; data: KnowledgeAnswer } | { ok: false; error: string }`.
  - `askKnowledgeBridge(question: string): Promise<KnowledgeResult>`.

- [ ] **Step 1: Write the failing test**

`lib/concierge/knowledge-bridge.test.ts`:

```ts
import assert from "node:assert/strict"
import { afterEach, test } from "node:test"

import { askKnowledgeBridge } from "./knowledge-bridge"

const realFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = realFetch
})

test("maps a 200 response to ok with data", async () => {
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({ answer: "Cancel free up to 24h.", citations: [], found: true }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )) as typeof fetch

  const result = await askKnowledgeBridge("cancellation policy?")
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.data.answer, "Cancel free up to 24h.")
})

test("maps a 503 to a not-ingested error", async () => {
  globalThis.fetch = (async () => new Response("{}", { status: 503 })) as typeof fetch
  const result = await askKnowledgeBridge("x")
  assert.equal(result.ok, false)
  if (!result.ok) assert.match(result.error, /ingested/i)
})

test("maps a network throw to a reachable-service error", async () => {
  globalThis.fetch = (async () => {
    throw new Error("ECONNREFUSED")
  }) as typeof fetch
  const result = await askKnowledgeBridge("x")
  assert.equal(result.ok, false)
  if (!result.ok) assert.match(result.error, /reach/i)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test lib/concierge/knowledge-bridge.test.ts`
Expected: FAIL — cannot find module `./knowledge-bridge`.

- [ ] **Step 3: Write `knowledge-bridge.ts`**

```ts
import { AGENT_BRIDGE_TIMEOUT_MS, getAgentBridgeUrl } from "@/lib/concierge/agent-bridge"

export type KnowledgeCitation = { source: string; page: number; snippet: string }
export type KnowledgeAnswer = {
  answer: string
  citations: KnowledgeCitation[]
  found: boolean
}
export type KnowledgeResult =
  | { ok: true; data: KnowledgeAnswer }
  | { ok: false; error: string }

export async function askKnowledgeBridge(question: string): Promise<KnowledgeResult> {
  try {
    const response = await fetch(`${getAgentBridgeUrl()}/api/knowledge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
      cache: "no-store",
      signal: AbortSignal.timeout(AGENT_BRIDGE_TIMEOUT_MS),
    })

    if (response.status === 503) {
      return {
        ok: false,
        error: "The policy knowledge base has not been ingested yet. Run python ingest_kb.py.",
      }
    }
    if (!response.ok) {
      return { ok: false, error: "The policy search service is unavailable." }
    }

    const data = (await response.json()) as KnowledgeAnswer
    return { ok: true, data }
  } catch {
    return { ok: false, error: "Could not reach the policy search service." }
  }
}
```

- [ ] **Step 4: Add the test to `test:unit` and run it**

In `package.json`, append ` lib/concierge/knowledge-bridge.test.ts` to the end of the `test:unit` command string.

Run: `npx tsx --test lib/concierge/knowledge-bridge.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/concierge/knowledge-bridge.ts lib/concierge/knowledge-bridge.test.ts package.json
git commit -m "feat: add knowledge-bridge client with error mapping"
```

---

### Task 8: Admin-gated proxy route `/api/admin/knowledge`

**Files:**
- Create: `app/api/admin/knowledge/route.ts`

**Interfaces:**
- Consumes: `auth` from `@/auth`; `askKnowledgeBridge` from `@/lib/concierge/knowledge-bridge`; `checkRateLimit`, `getClientIp` from `@/lib/concierge/rate-limit`.
- Produces: `POST /api/admin/knowledge` — `{ ok: true; answer; citations; found } | { ok: false; error }`, admin-gated.

- [ ] **Step 1: Write the route**

`app/api/admin/knowledge/route.ts`:

```ts
import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { askKnowledgeBridge } from "@/lib/concierge/knowledge-bridge"
import { checkRateLimit, getClientIp } from "@/lib/concierge/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
  }

  const rate = checkRateLimit(getClientIp(req))
  if (!rate.ok) {
    return NextResponse.json({ ok: false, error: rate.error }, { status: 429 })
  }

  let question = ""
  try {
    const body = (await req.json()) as { question?: string }
    question = (body.question ?? "").trim()
  } catch {
    question = ""
  }
  if (!question) {
    return NextResponse.json({ ok: false, error: "Question is required." }, { status: 400 })
  }

  const result = await askKnowledgeBridge(question)
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 })
  }
  return NextResponse.json({ ok: true, ...result.data })
}
```

- [ ] **Step 2: Verify it typechecks and lints**

Run: `npm run lint`
Expected: no errors for the new file.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/knowledge/route.ts
git commit -m "feat: add admin-gated policy knowledge proxy route"
```

---

### Task 9: Admin UI — page, panel, nav link

**Files:**
- Create: `app/admin/knowledge/page.tsx`
- Create: `components/admin/knowledge-panel.tsx`
- Modify: `components/admin/admin-nav-items.ts`

**Interfaces:**
- Consumes: `POST /api/admin/knowledge` returning `{ ok; answer; citations; found } | { ok:false; error }`; `KnowledgeCitation` type from `@/lib/concierge/knowledge-bridge`.
- Produces: the `/admin/knowledge` route and a "Policy Search" nav entry.

- [ ] **Step 1: Add the nav item**

In `components/admin/admin-nav-items.ts`, import `FileSearch` from `lucide-react` and add to `ADMIN_NAV_ITEMS` (after "Calendar"):

```ts
{ href: "/admin/knowledge", label: "Policy Search", icon: FileSearch },
```

- [ ] **Step 2: Create the server page**

`app/admin/knowledge/page.tsx`:

```tsx
import { KnowledgePanel } from "@/components/admin/knowledge-panel"

export const metadata = { title: "Policy Search — Hôtel Levio Admin" }
export const dynamic = "force-dynamic"

export default function AdminKnowledgePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl tracking-tight">Policy Search</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">
          Ask about hotel policies and procedures. Answers are drawn only from the
          ingested policy documents, with sources cited.
        </p>
      </div>
      <KnowledgePanel />
    </div>
  )
}
```

- [ ] **Step 3: Create the client panel**

`components/admin/knowledge-panel.tsx`:

```tsx
"use client"

import * as React from "react"

import type { KnowledgeCitation } from "@/lib/concierge/knowledge-bridge"
import { Button } from "@/components/ui/button"

type AnswerState = {
  answer: string
  citations: KnowledgeCitation[]
  found: boolean
}

export function KnowledgePanel() {
  const [question, setQuestion] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<AnswerState | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const text = question.trim()
    if (!text || loading) return

    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const response = await fetch("/api/admin/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      })
      const data = (await response.json()) as
        | { ok: true; answer: string; citations: KnowledgeCitation[]; found: boolean }
        | { ok: false; error: string }
      if (!data.ok) {
        setError(data.error)
        return
      }
      setResult({ answer: data.answer, citations: data.citations, found: data.found })
    } catch {
      setError("Could not reach the policy search service.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          aria-label="Policy question"
          placeholder="e.g. What is the guest cancellation policy?"
          className="border-input bg-background h-10 min-w-0 flex-1 rounded-md border px-3 text-sm outline-none"
        />
        <Button type="submit" variant="action" disabled={loading || !question.trim()}>
          {loading ? "Searching…" : "Search"}
        </Button>
      </form>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-destructive">Policy search unavailable</p>
          <p className="text-muted-foreground mt-1">{error}</p>
        </div>
      ) : null}

      {result ? (
        <div className="rounded-lg border bg-card p-4 text-sm">
          <p className="whitespace-pre-wrap">{result.answer}</p>
          {result.citations.length > 0 ? (
            <details className="mt-3">
              <summary className="text-muted-foreground cursor-pointer text-xs font-medium">
                Sources ({result.citations.length})
              </summary>
              <ul className="mt-2 space-y-2">
                {result.citations.map((citation, index) => (
                  <li key={`${citation.source}-${citation.page}-${index}`} className="text-muted-foreground text-xs">
                    <span className="font-medium">
                      {citation.source}, p. {citation.page}
                    </span>
                    <span className="mt-0.5 block">{citation.snippet}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 4: Verify lint passes**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/admin/knowledge/page.tsx components/admin/knowledge-panel.tsx components/admin/admin-nav-items.ts
git commit -m "feat: add Policy Search admin page, panel, and nav link"
```

---

### Task 10: Playwright gate test + full lint

**Files:**
- Create: `tests/admin-knowledge.spec.ts`

**Interfaces:**
- Consumes: the `/admin/knowledge` route and middleware gating.
- Produces: a deterministic e2e test that the page is admin-gated.

- [ ] **Step 1: Write the test**

`tests/admin-knowledge.spec.ts`:

```ts
import { test, expect } from "@playwright/test"

test.describe("Admin policy search", () => {
  test("redirects unauthenticated users away from /admin/knowledge", async ({ page }) => {
    await page.goto("/admin/knowledge")
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole("button", { name: /sign in/i }).first()).toBeVisible()
  })
})
```

- [ ] **Step 2: Run the test**

Run: `npx playwright test tests/admin-knowledge.spec.ts --reporter=list`
Expected: PASS (middleware redirects `/admin/*` to `/login` for non-admins).

If the sign-in button assertion fails because the login page uses different copy, adjust the selector to match the actual `/login` page (open `app/login` to confirm the visible submit label), then re-run. The URL assertion is the primary gate check.

- [ ] **Step 3: Run the full lint + unit suites**

Run: `npm run lint && npm run test:unit`
Expected: lint clean; all unit tests (including the new `knowledge-bridge.test.ts`) pass.

- [ ] **Step 4: Commit**

```bash
git add tests/admin-knowledge.spec.ts
git commit -m "test: gate check for /admin/knowledge"
```

---

### Task 11: Documentation

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: nothing.
- Produces: setup docs for the knowledge base.

- [ ] **Step 1: Extend the "Running Locally" concierge step in `CLAUDE.md`**

In the optional agent-bridge step (step 4), after `pip install -r requirements.txt`, add the knowledge-base setup:

```bash
# (Optional) Build the admin policy knowledge base
ollama pull nomic-embed-text        # embeddings model
# place policy PDFs in app/agents/hotel-ai-agent/data/policies/
python ingest_kb.py                 # builds kb_store/ index for /admin/knowledge
```

- [ ] **Step 2: Add a short subsection after the Neo4j section**

```markdown
## Admin policy knowledge base (optional)

Admins can search hotel policy documents at `/admin/knowledge` ("Policy Search").
Document-RAG runs in the Python bridge: `ingest_kb.py` embeds PDFs from
`app/agents/hotel-ai-agent/data/policies/` (via Ollama `nomic-embed-text`) into a
local Chroma index (`kb_store/`); `POST /api/knowledge` retrieves and answers with
`llama3`, citing sources. PDFs and the index are gitignored. Answers are grounded —
if the documents don't cover a question, the assistant says so.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document the admin policy knowledge base"
```

---

## Self-Review

**Spec coverage:**
- Admin-only `/admin/knowledge` document-RAG → Tasks 8–10. ✓
- Runs in Python bridge, Ollama embeddings, Chroma → Tasks 2–6. ✓
- Local PDF ingestion, gitignored corpus + index → Tasks 1, 5. ✓
- Grounding guardrail + "not in the documents" → Task 4 (`answer`), Task 2 (`select_relevant`). ✓
- Proxy re-checks ADMIN (middleware skips `/api/*`) → Task 8. ✓
- Citations (source + page + snippet) → Tasks 3–4, rendered in Task 9. ✓
- 503-when-not-ingested + graceful UI → Tasks 6, 7, 9. ✓
- New deps in requirements + Ollama model pull documented → Tasks 1, 11. ✓
- Tests (chunking, prompt, retrieval, answer, endpoint; bridge mapping; e2e gate) → Tasks 2–7, 10. ✓
- Deviation from the spec's single authenticated Playwright test is documented in "Testing note" and reconciled with unit coverage. ✓

**Placeholder scan:** No TBD/TODO; every code step has full content. ✓

**Type consistency:** `Passage`, `Citation`, `KnowledgeAnswer` used identically across Tasks 2–6; `answer(question, *, store, model, ...)` signature matches its call in Task 6; `askKnowledgeBridge` return shape matches its consumer in Task 8; `KnowledgeCitation` shape matches the panel in Task 9. ✓
