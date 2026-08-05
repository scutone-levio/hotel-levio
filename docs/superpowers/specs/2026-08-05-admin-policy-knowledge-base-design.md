# Admin Policy Knowledge Base (RAG) — Design

**Date:** 2026-08-05
**Status:** Approved design, pending implementation plan
**Surface:** Admin-only (`/admin/knowledge`)

## Goal

Give hotel admins a searchable knowledge base over internal **policy & procedure
documents** (starting with a Sheraton policies-and-procedures PDF). An admin asks
a natural-language question ("What is the guest cancellation policy?") and gets a
grounded answer synthesized from the policy documents, with citations back to the
source file and page. This is document-based Retrieval-Augmented Generation (RAG):
retrieve relevant passages, then generate an answer constrained to those passages.

Non-goals:
- No guest-facing exposure. This is separate from the guest concierge chat.
- No querying of Postgres/Neo4j business data. This is document RAG only.
- No Kaggle involvement (an earlier direction, since dropped).

## Constraints & decisions

- **Runs in the existing Python bridge** (`app/agents/hotel-ai-agent/`, FastAPI +
  LangChain + Ollama). It already hosts the LLM stack.
- **Local, self-contained pipeline** — no new external services. Embeddings via
  Ollama; vector index persisted to local disk (Chroma).
- **Corpus is local PDF files**, gitignored. Admins download policy PDFs via
  browser (the source site is behind a Cloudflare challenge, so no runtime fetch)
  and drop them into a data folder. The Chroma index is also gitignored.
- **Grounding guardrail:** the model answers *only* from retrieved passages and
  explicitly says when the answer is not in the documents — no hallucinated policy.
- **Admin-only**, enforced in the proxy route (middleware does not cover `/api/*`).

## Architecture

```
Admin browser
  → /admin/knowledge (Next.js server page, middleware-gated ADMIN)
      → components/admin/knowledge-panel.tsx (client Q&A UI, "Policy Search")
          → POST /api/admin/knowledge (Next.js route; re-checks ADMIN session; rate-limited)
              → POST /api/knowledge (Python bridge, http://127.0.0.1:8000)
                  → embed query (Ollama nomic-embed-text)
                  → Chroma top-k similarity search over kb_store/
                  → build grounded prompt → llama3 → answer + citations
```

Ingestion is an offline CLI, run once (and re-run when PDFs change):

```
python ingest_kb.py
  → read data/policies/*.pdf (pypdf)
  → split into ~800-char chunks (recursive splitter, ~150 overlap)
  → attach metadata { source: filename, page: N, section?: heading }
  → embed (Ollama nomic-embed-text)
  → persist Chroma index to kb_store/
```

## Components

Each unit has one purpose and is testable in isolation.

### Python bridge (`app/agents/hotel-ai-agent/`)

- **`ingest_kb.py`** (CLI) — discovers PDFs in `data/policies/`, extracts text per
  page, chunks, embeds, and persists the Chroma collection. Idempotent: rebuilds the
  collection from scratch each run. Prints a summary (files, pages, chunks). Exits
  non-zero on failure (no PDFs found, extraction error, Ollama/embedding unreachable).
- **`knowledge.py`** — the retrieval + answer module, kept independent of FastAPI:
  - `load_store() -> Chroma | None` — opens the persisted index; returns `None` if
    it does not exist yet.
  - `retrieve(store, query, k) -> list[Passage]` — similarity search; each `Passage`
    carries text + metadata + score.
  - `build_prompt(question, passages) -> str` — assembles the grounded prompt.
  - `answer(question, k) -> KnowledgeAnswer` — orchestrates the above and calls
    `llama3`; returns `{ answer, citations, found }`. When no passage clears a
    minimum similarity threshold, returns `found=false` and a fixed "not in the
    policy documents" message without calling the LLM.
- **FastAPI `POST /api/knowledge`** (added to `app.py`, consistent with the existing
  single-file bridge) — Pydantic
  request `{ question: str }` / response `{ answer, citations, found }`. Returns
  **503** with `{ detail: "Knowledge base not ingested." }` when `load_store()` is
  `None`. `citations` is a list of `{ source, page, snippet }`.

### Next.js

- **`app/api/admin/knowledge/route.ts`** — `POST` proxy. Steps: (1) `auth()` and
  reject non-`ADMIN` with 403; (2) apply the existing rate-limit helper; (3) forward
  to the bridge via `getAgentBridgeUrl()` with an abort timeout; (4) return the
  `{ ok: true, ... }` / `{ ok: false, error }` envelope. A 503 from the bridge maps
  to a friendly "not ingested yet" error.
- **`lib/concierge/knowledge-bridge.ts`** (new file) — shared types
  (`KnowledgeCitation`, `KnowledgeAnswerResponse`) and the fetch call, mirroring
  `agent-bridge.ts` and reusing its `getAgentBridgeUrl()`.
- **`app/admin/knowledge/page.tsx`** — server component shell. Title "Policy Search",
  short description, renders the client panel. `export const dynamic = "force-dynamic"`.
- **`components/admin/knowledge-panel.tsx`** — client Q&A UI: question input, submit,
  answer rendered on top, collapsible **Sources** list beneath (file + page + snippet).
  Loading and error states. When the bridge/store is unavailable, shows an
  "unavailable" notice mirroring the `/admin/insights` pattern (with a hint to run
  `python ingest_kb.py`).

### Configuration & dependencies

- New Python deps in `requirements.txt`: `pypdf` (PDF text extraction), `chromadb`
  (vector store), and `langchain-chroma` (LangChain Chroma wrapper).
- Ollama model: pull `nomic-embed-text` for embeddings (documented in CLAUDE.md
  alongside the existing `llama3`).
- No new env vars required (reuses `AGENT_BRIDGE_URL`). Tunables (`KB_TOP_K`,
  `KB_STORE_DIR`, `KB_DATA_DIR`, similarity threshold) read from env with sensible
  defaults.
- `.gitignore`: add `app/agents/hotel-ai-agent/data/policies/` (PDFs) and
  `app/agents/hotel-ai-agent/kb_store/` (index). Add a `data/policies/.gitkeep` and
  a short `data/policies/README.md` explaining where to place PDFs.

## Data flow (query)

1. Admin submits a question in `/admin/knowledge`.
2. `POST /api/admin/knowledge` verifies ADMIN session, rate-limits, forwards.
3. Bridge embeds the question, runs Chroma top-k (`KB_TOP_K`, default 4).
4. If the best score is below threshold → `found=false`, fixed message, no LLM call.
5. Otherwise `llama3` answers from the retrieved passages only.
6. Response returns answer + citations; the panel renders answer + collapsible sources.

## Error handling

| Condition | Behavior |
|---|---|
| Index not built (`kb_store/` missing) | Bridge 503 "Knowledge base not ingested."; panel shows unavailable notice + ingest hint. |
| Non-admin hits `/api/admin/knowledge` | 403 before any bridge call. |
| Bridge unreachable / timeout | Proxy returns `{ ok: false, error }`; panel shows a reachable-service error. |
| No relevant passage found | `found=false`, "I couldn't find that in the policy documents." (not an error). |
| Ingestion: no PDFs / extraction fails / Ollama down | Clear CLI message, non-zero exit. A failed run may leave a partial index; the next successful run rebuilds it from scratch (ingestion is idempotent). |

Follows project conventions: server/proxy returns `{ ok }` discriminated unions and
never throws to the client; email-style fire-and-forget not relevant here.

## Testing

- **Python unit tests** (pytest):
  - chunking: a small text splits into expected chunk count with page metadata.
  - `build_prompt`: includes passages and the grounding instruction.
  - `answer` with a tiny fixture Chroma index (2–3 synthetic passages): returns a
    citation for a matching query and `found=false` for an off-topic query.
- **TypeScript / Playwright** (`tests/admin-knowledge.spec.ts`): tolerant test that,
  as an authenticated admin, `/admin/knowledge` loads, the input is present, and a
  submitted question degrades gracefully (unavailable/error notice, no page crash)
  when the bridge/store is down — mirroring `tests/concierge-chat.spec.ts`.
- **Lint:** `npm run lint` clean; Python `venv`/`__pycache__`/`kb_store`/`data`
  already excluded from ESLint and git.

## Documentation

Update `CLAUDE.md` "Running Locally": add pulling `nomic-embed-text`, placing PDFs in
`data/policies/`, and running `python ingest_kb.py` before using `/admin/knowledge`.

## Out of scope (possible follow-ups)

- Multi-document management UI (upload from the admin panel instead of CLI ingest).
- Precomputed structured aggregates for numeric questions.
- Incremental/append ingestion instead of full rebuild.
- Answer streaming.
