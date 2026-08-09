"""Final consistency pass over the assembled document (design doc §12)."""

from __future__ import annotations

import json
from pathlib import Path

from . import glossary as glossary_mod
from . import manifest as manifest_mod
from . import translator as translator_mod
from .config import GLOBAL_GLOSSARY_PATH, project_paths


class QAError(RuntimeError):
    pass


def run_qa(project_dir: Path, *, client=None) -> dict:
    paths = project_paths(project_dir)
    manifest = manifest_mod.load(paths["manifest"])
    if not paths["assembled_txt"].exists():
        raise QAError(
            "assembled.txt not found. Run `arabic-translate assemble` first."
        )

    assembled = paths["assembled_txt"].read_text(encoding="utf-8")
    effective = glossary_mod.merged(GLOBAL_GLOSSARY_PATH, paths["glossary"])
    glossary_block = glossary_mod.format_for_prompt(effective)

    report = translator_mod.qa_review(
        model=manifest.model,
        assembled_english=assembled,
        glossary_block=glossary_block,
        client=client,
    )
    paths["qa_report"].parent.mkdir(parents=True, exist_ok=True)
    paths["qa_report"].write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return report
