"""Manifest = source of truth for pipeline state (design doc §7).

Statuses form a monotonic progression:
    pending -> translated -> assembled
Plus "error" as a terminal-for-now state that can be retried.
"""

from __future__ import annotations

import json
import os
import tempfile
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Optional

STATUS_PENDING = "pending"
STATUS_TRANSLATED = "translated"
STATUS_ASSEMBLED = "assembled"
STATUS_ERROR = "error"

VALID_STATUSES = {STATUS_PENDING, STATUS_TRANSLATED, STATUS_ASSEMBLED, STATUS_ERROR}


@dataclass
class ChunkEntry:
    id: str
    status: str
    source_path: str
    translated_path: str
    word_count_src: int
    attempts: int = 0
    last_error: Optional[str] = None


@dataclass
class Manifest:
    source_file: str
    chunk_size_target_words: int
    model: str
    chunks: list[ChunkEntry] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "source_file": self.source_file,
            "chunk_size_target_words": self.chunk_size_target_words,
            "model": self.model,
            "chunks": [asdict(c) for c in self.chunks],
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Manifest":
        return cls(
            source_file=data["source_file"],
            chunk_size_target_words=data.get("chunk_size_target_words", 1500),
            model=data.get("model", ""),
            chunks=[ChunkEntry(**c) for c in data.get("chunks", [])],
        )

    def get(self, chunk_id: str) -> ChunkEntry:
        for c in self.chunks:
            if c.id == chunk_id:
                return c
        raise KeyError(chunk_id)


def load(path: Path) -> Manifest:
    path = Path(path)
    with path.open("r", encoding="utf-8") as fh:
        return Manifest.from_dict(json.load(fh))


def save(manifest: Manifest, path: Path) -> None:
    """Atomic write: temp file in the same directory, then rename."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(
        prefix=path.name + ".", suffix=".tmp", dir=str(path.parent)
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(manifest.to_dict(), fh, ensure_ascii=False, indent=2)
        os.replace(tmp_name, path)
    except Exception:
        try:
            os.unlink(tmp_name)
        except OSError:
            pass
        raise
