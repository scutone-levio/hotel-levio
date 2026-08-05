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


def test_main_preserves_existing_store_when_no_text(tmp_path, monkeypatch, capsys):
    # Set up an existing store with a marker file
    store = tmp_path / "kb"
    store.mkdir()
    marker = store / "chroma.sqlite3"
    marker.write_text("x")

    monkeypatch.setattr(ingest_kb, "discover_pdfs", lambda data_dir=None: ["/x/policies.pdf"])
    monkeypatch.setattr(ingest_kb.knowledge, "iter_pdf_pages", lambda path: [])  # No extractable text
    monkeypatch.setattr(ingest_kb.knowledge, "KB_STORE_DIR", str(store))

    assert ingest_kb.main() == 1
    assert marker.exists()  # Store was NOT deleted
    assert "No extractable text found" in capsys.readouterr().out
