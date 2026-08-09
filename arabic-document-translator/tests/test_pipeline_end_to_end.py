"""End-to-end pipeline test using a fake LLMClient.

Covers init → run → assemble on a small .txt document, plus resumability
(a second `run` should be a no-op).
"""

from __future__ import annotations

import pytest

from arabic_document_translator import manifest as manifest_mod
from arabic_document_translator.providers.base import LLMClient


class FakeClient(LLMClient):
    """A deterministic fake that mimics translation, glossary extraction,
    style-guide bootstrap, and QA based on prompt content."""

    def __init__(self):
        self.model = "fake:test-model"
        self.calls = 0

    def complete(self, *, system: str, user: str, max_tokens: int) -> str:
        self.calls += 1
        # Style guide bootstrap
        if "style guide" in user.lower() and "SAMPLE" in user:
            return "# Style Guide\n- Register: neutral formal."
        # Glossary extraction — expects JSON
        if "new_terms" in user:
            return '{"new_terms": []}'
        # QA
        if "issues" in user and "ASSEMBLED" in user:
            return '{"issues": []}'
        # Translation: pretend the English is "EN: " + first line of source.
        src_start = user.find("ARABIC SOURCE TO TRANSLATE")
        body = user[src_start:].split("\n", 1)[1] if src_start >= 0 else user
        return "EN: " + body.strip().split("\n\n")[0][:60]


@pytest.fixture
def isolated_home(tmp_path, monkeypatch):
    """Redirect the global glossary dir so tests don't touch ~/."""
    home = tmp_path / "home"
    home.mkdir()
    monkeypatch.setenv("ARABIC_TRANSLATOR_HOME", str(home))
    import importlib

    from arabic_document_translator import config as cfg_mod
    from arabic_document_translator import pipeline as pipe_mod
    from arabic_document_translator import qa as qa_mod
    importlib.reload(cfg_mod)
    importlib.reload(pipe_mod)
    importlib.reload(qa_mod)
    yield home


def test_full_pipeline_txt(tmp_path, isolated_home):
    from arabic_document_translator import assembler as asm_mod
    from arabic_document_translator import pipeline as pipe_mod

    source = tmp_path / "src.txt"
    source.write_text(
        "الفقرة الأولى.\n\nالفقرة الثانية.\n\nالفقرة الثالثة.\n",
        encoding="utf-8",
    )
    project = tmp_path / "proj"

    manifest = pipe_mod.init_project(source, project, chunk_words=5)
    assert len(manifest.chunks) >= 1

    client = FakeClient()
    translated, errored = pipe_mod.run_translation(project, client=client)
    assert errored == 0
    assert translated == len(manifest.chunks)

    for entry in manifest_mod.load(project / "manifest.json").chunks:
        assert (project / entry.translated_path).exists()

    # A second run is a no-op (all translated).
    translated2, errored2 = pipe_mod.run_translation(project, client=client)
    assert (translated2, errored2) == (0, 0)

    log = asm_mod.assemble(project, make_docx=False)
    assert log["chunk_count"] == len(manifest.chunks)
    assert (project / "output" / "assembled.txt").exists()

    final_manifest = manifest_mod.load(project / "manifest.json")
    assert all(c.status == "assembled" for c in final_manifest.chunks)


def test_run_records_error_and_continues(tmp_path, isolated_home):
    """A failing provider call should mark the chunk errored, not crash the run."""
    from arabic_document_translator import pipeline as pipe_mod

    source = tmp_path / "src.txt"
    source.write_text("para one.\n\npara two.\n", encoding="utf-8")
    project = tmp_path / "proj"
    pipe_mod.init_project(source, project, chunk_words=1)

    class BoomClient(LLMClient):
        model = "fake:boom"

        def complete(self, **kwargs):
            raise RuntimeError("simulated api failure")

    translated, errored = pipe_mod.run_translation(project, client=BoomClient())
    assert translated == 0
    assert errored >= 1
    m = manifest_mod.load(project / "manifest.json")
    assert any(c.status == "error" and c.last_error for c in m.chunks)


def test_assemble_refuses_when_chunks_pending(tmp_path, isolated_home):
    from arabic_document_translator import assembler as asm_mod
    from arabic_document_translator import pipeline as pipe_mod

    source = tmp_path / "src.txt"
    source.write_text("only one paragraph.\n", encoding="utf-8")
    project = tmp_path / "proj"
    pipe_mod.init_project(source, project)

    with pytest.raises(asm_mod.AssemblyError):
        asm_mod.assemble(project, make_docx=False)
