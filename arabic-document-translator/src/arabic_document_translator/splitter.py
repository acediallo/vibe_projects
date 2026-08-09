"""Greedy paragraph-boundary chunker.

Rules (design doc §5):
- Never split mid-paragraph.
- Headings always start a new chunk.
- Group paragraphs into chunks up to a target word count, cut at the next
  paragraph boundary once the target is reached.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from .ingest import Block


@dataclass
class Chunk:
    id: str
    text: str
    word_count: int
    starts_with_heading: bool


def _word_count(text: str) -> int:
    return len(text.split())


def split_blocks(blocks: Iterable[Block], target_words: int) -> list[Chunk]:
    """Group blocks into chunks. Returns chunks in document order."""
    chunks: list[Chunk] = []
    buf: list[str] = []
    buf_words = 0
    buf_starts_heading = False

    def flush() -> None:
        nonlocal buf, buf_words, buf_starts_heading
        if not buf:
            return
        cid = f"chunk_{len(chunks) + 1:04d}"
        chunks.append(
            Chunk(
                id=cid,
                text="\n\n".join(buf).strip(),
                word_count=buf_words,
                starts_with_heading=buf_starts_heading,
            )
        )
        buf = []
        buf_words = 0
        buf_starts_heading = False

    for kind, text in blocks:
        text = text.strip()
        if not text:
            continue
        wc = _word_count(text)
        # Headings force a new chunk.
        if kind == "heading":
            flush()
            buf_starts_heading = True
            buf.append(text)
            buf_words += wc
            continue

        if not buf:
            buf.append(text)
            buf_words = wc
            continue

        # If we're already at/over target, cut before appending.
        if buf_words >= target_words:
            flush()
            buf.append(text)
            buf_words = wc
        else:
            buf.append(text)
            buf_words += wc

    flush()
    return chunks
