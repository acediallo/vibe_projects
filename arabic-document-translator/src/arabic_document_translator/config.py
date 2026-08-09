"""Constants and shared paths used across the pipeline."""

from __future__ import annotations

import os
from pathlib import Path

DEFAULT_MODEL = "claude-sonnet-5"
DEFAULT_CHUNK_WORDS = 1500
DEFAULT_CARRY_WORDS = 150
DEFAULT_MAX_RETRIES = 3

GLOBAL_DIR = Path(
    os.environ.get("ARABIC_TRANSLATOR_HOME")
    or (Path.home() / ".translation_pipeline")
)
GLOBAL_GLOSSARY_PATH = GLOBAL_DIR / "global_glossary.json"


def project_paths(project_dir: Path) -> dict[str, Path]:
    """Return the canonical subpath layout inside a project directory."""
    project_dir = Path(project_dir)
    return {
        "root": project_dir,
        "source": project_dir / "source",
        "chunks": project_dir / "chunks",
        "translated": project_dir / "translated",
        "output": project_dir / "output",
        "manifest": project_dir / "manifest.json",
        "glossary": project_dir / "glossary.json",
        "style_guide": project_dir / "style_guide.md",
        "assembled_txt": project_dir / "output" / "assembled.txt",
        "assembled_docx": project_dir / "output" / "assembled.docx",
        "assembly_log": project_dir / "output" / "assembly_log.json",
        "qa_report": project_dir / "output" / "qa_report.json",
    }


def ensure_project_dirs(project_dir: Path) -> dict[str, Path]:
    """Create the project's directory skeleton and return the path map."""
    paths = project_paths(project_dir)
    for key in ("root", "source", "chunks", "translated", "output"):
        paths[key].mkdir(parents=True, exist_ok=True)
    return paths
