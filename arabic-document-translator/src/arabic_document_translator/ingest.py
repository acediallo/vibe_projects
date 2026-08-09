"""Load source documents and produce an ordered list of paragraph blocks.

Each block is a (kind, text) tuple where kind is "heading" or "paragraph".
Downstream, the splitter uses heading boundaries as hard chunk cuts.
"""

from __future__ import annotations

from pathlib import Path
from typing import Iterable

Block = tuple[str, str]  # ("heading" | "paragraph", text)


def load_blocks(source_path: Path) -> list[Block]:
    """Dispatch on file extension and return the source's blocks in order."""
    source_path = Path(source_path)
    ext = source_path.suffix.lower()
    if ext == ".txt":
        return _load_txt(source_path)
    if ext == ".docx":
        return _load_docx(source_path)
    raise ValueError(
        f"Unsupported input format {ext!r}. Supported: .txt, .docx."
    )


def _load_txt(path: Path) -> list[Block]:
    text = path.read_text(encoding="utf-8")
    blocks: list[Block] = []
    for chunk in _split_paragraphs(text.splitlines()):
        if chunk:
            blocks.append(("paragraph", chunk))
    return blocks


def _split_paragraphs(lines: Iterable[str]) -> Iterable[str]:
    buf: list[str] = []
    for line in lines:
        if line.strip():
            buf.append(line.rstrip())
        elif buf:
            yield "\n".join(buf).strip()
            buf = []
    if buf:
        yield "\n".join(buf).strip()


def _load_docx(path: Path) -> list[Block]:
    from docx import Document  # imported lazily so .txt-only users don't need it

    doc = Document(str(path))
    blocks: list[Block] = []
    for para in doc.paragraphs:
        text = (para.text or "").strip()
        if not text:
            continue
        style_name = (para.style.name if para.style else "") or ""
        kind = "heading" if style_name.lower().startswith("heading") else "paragraph"
        blocks.append((kind, text))
    return blocks
