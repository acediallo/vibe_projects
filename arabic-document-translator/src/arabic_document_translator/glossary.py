"""Global + project-local glossary layering (design doc §8).

- Global file: ~/.translation_pipeline/global_glossary.json — human-curated,
  never auto-written.
- Project file: <project>/glossary.json — auto-populated as the pipeline
  discovers new terms.
- Merge rule at prompt-build time: project entries override globals for the
  same key.
"""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Optional


def _load_json(path: Path) -> dict:
    if not path.exists():
        return {"terms": {}}
    with path.open("r", encoding="utf-8") as fh:
        data = json.load(fh)
    data.setdefault("terms", {})
    return data


def load_global(path: Path) -> dict:
    return _load_json(Path(path))


def load_project(path: Path) -> dict:
    return _load_json(Path(path))


def save_project(data: dict, path: Path) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(
        prefix=path.name + ".", suffix=".tmp", dir=str(path.parent)
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False, indent=2)
        os.replace(tmp_name, path)
    except Exception:
        try:
            os.unlink(tmp_name)
        except OSError:
            pass
        raise


def merged(global_path: Path, project_path: Path) -> dict[str, dict]:
    """Return the effective term dictionary (project entries win)."""
    g = load_global(global_path).get("terms", {})
    p = load_project(project_path).get("terms", {})
    out: dict[str, dict] = {}
    out.update(g)
    out.update(p)  # project wins
    return out


def add_project_term(
    project_path: Path,
    arabic: str,
    english: str,
    first_seen: str,
    global_path: Optional[Path] = None,
) -> tuple[bool, Optional[str]]:
    """Add a term to the project glossary.

    Returns (added, conflict_reason). If the term already exists in the global
    glossary with a different English translation, we still add it (project
    wins per spec §8) but flag the conflict so the caller can surface it.
    """
    data = load_project(project_path)
    terms = data["terms"]
    if arabic in terms:
        return False, None  # already known locally, no-op

    conflict: Optional[str] = None
    if global_path is not None:
        g = load_global(global_path).get("terms", {})
        if arabic in g and g[arabic].get("en") != english:
            conflict = (
                f"global entry has en={g[arabic].get('en')!r}, "
                f"project proposes en={english!r}"
            )

    terms[arabic] = {
        "en": english,
        "first_seen": first_seen,
        "source": "project",
    }
    save_project(data, project_path)
    return True, conflict


def format_for_prompt(effective: dict[str, dict]) -> str:
    """Render the merged glossary as a compact block for injection."""
    if not effective:
        return "(none yet)"
    lines = []
    for ar, entry in sorted(effective.items()):
        lines.append(f"- {ar}  →  {entry.get('en', '')}")
    return "\n".join(lines)
