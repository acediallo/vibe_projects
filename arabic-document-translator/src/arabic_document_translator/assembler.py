"""Concatenate translated chunks into the final output (design doc §11)."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from . import manifest as manifest_mod
from .config import project_paths


class AssemblyError(RuntimeError):
    pass


def assemble(project_dir: Path, *, make_docx: bool = True) -> dict:
    paths = project_paths(project_dir)
    manifest = manifest_mod.load(paths["manifest"])

    not_ready = [
        c.id
        for c in manifest.chunks
        if c.status not in (manifest_mod.STATUS_TRANSLATED, manifest_mod.STATUS_ASSEMBLED)
    ]
    if not_ready:
        raise AssemblyError(
            f"{len(not_ready)} chunk(s) not yet translated: {', '.join(not_ready[:5])}"
            + (" ..." if len(not_ready) > 5 else "")
        )

    pieces: list[str] = []
    used: list[dict] = []
    for entry in manifest.chunks:
        p = paths["root"] / entry.translated_path
        text = p.read_text(encoding="utf-8").strip()
        pieces.append(text)
        used.append({
            "id": entry.id,
            "path": entry.translated_path,
            "mtime": p.stat().st_mtime,
        })

    assembled = "\n\n".join(pieces).strip() + "\n"
    paths["assembled_txt"].parent.mkdir(parents=True, exist_ok=True)
    paths["assembled_txt"].write_text(assembled, encoding="utf-8")

    docx_written = False
    if make_docx:
        try:
            _write_docx(assembled, paths["assembled_docx"])
            docx_written = True
        except ImportError:
            docx_written = False

    for entry in manifest.chunks:
        entry.status = manifest_mod.STATUS_ASSEMBLED
    manifest_mod.save(manifest, paths["manifest"])

    log = {
        "assembled_at": datetime.now(timezone.utc).isoformat(),
        "chunk_count": len(used),
        "docx_written": docx_written,
        "chunks": used,
    }
    paths["assembly_log"].write_text(
        json.dumps(log, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return log


def _write_docx(text: str, path: Path) -> None:
    from docx import Document

    doc = Document()
    for para in text.split("\n\n"):
        para = para.strip()
        if para:
            doc.add_paragraph(para)
    doc.save(str(path))
