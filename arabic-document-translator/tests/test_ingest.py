import pytest

from arabic_document_translator.ingest import load_blocks


def test_txt_two_paragraphs(tmp_path):
    src = tmp_path / "sample.txt"
    src.write_text("first paragraph.\n\nsecond paragraph.\n", encoding="utf-8")
    blocks = load_blocks(src)
    assert blocks == [("paragraph", "first paragraph."), ("paragraph", "second paragraph.")]


def test_txt_blank_lines_ignored(tmp_path):
    src = tmp_path / "sample.txt"
    src.write_text("\n\n\nonly one\n\n\n", encoding="utf-8")
    blocks = load_blocks(src)
    assert blocks == [("paragraph", "only one")]


def test_unsupported_extension_raises(tmp_path):
    src = tmp_path / "x.pdf"
    src.write_text("dummy")
    with pytest.raises(ValueError):
        load_blocks(src)
