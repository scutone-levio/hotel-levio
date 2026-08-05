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

    # Extract and chunk FIRST, before touching the store
    all_docs = []
    for path in pdfs:
        pages = knowledge.iter_pdf_pages(path)
        docs = knowledge.chunk_pages(pages, source=os.path.basename(path))
        all_docs.extend(docs)
        print(f"  {os.path.basename(path)}: {len(pages)} pages -> {len(docs)} chunks")

    # Check if extraction yielded any text BEFORE deleting the old store
    if not all_docs:
        print("No extractable text found in the PDFs.")
        return 1

    # Only now, when we know we have data to rebuild with, delete and rebuild
    if os.path.isdir(knowledge.KB_STORE_DIR):
        shutil.rmtree(knowledge.KB_STORE_DIR)

    knowledge.build_store(all_docs)
    print(f"Ingested {len(pdfs)} file(s), {len(all_docs)} chunk(s) into {knowledge.KB_STORE_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
