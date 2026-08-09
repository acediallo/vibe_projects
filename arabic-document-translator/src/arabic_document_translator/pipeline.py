"""Orchestration: run the per-chunk translate → glossary → mark-complete loop."""

from __future__ import annotations

import shutil
from pathlib import Path
from typing import Callable, Optional

from . import glossary as glossary_mod
from . import manifest as manifest_mod
from . import translator as translator_mod
from .config import (
    DEFAULT_CARRY_WORDS,
    DEFAULT_CHUNK_WORDS,
    DEFAULT_MODEL,
    GLOBAL_GLOSSARY_PATH,
    ensure_project_dirs,
)
from .ingest import load_blocks
from .splitter import split_blocks


def init_project(
    source_file: Path,
    project_dir: Path,
    *,
    model: str = DEFAULT_MODEL,
    chunk_words: int = DEFAULT_CHUNK_WORDS,
) -> manifest_mod.Manifest:
    """Ingest, split, and lay down chunks/ and manifest.json."""
    paths = ensure_project_dirs(project_dir)
    source_file = Path(source_file)
    if not source_file.exists():
        raise FileNotFoundError(source_file)

    # Copy source into project so the project is self-contained.
    dest_source = paths["source"] / source_file.name
    if dest_source.resolve() != source_file.resolve():
        shutil.copy2(source_file, dest_source)

    blocks = load_blocks(dest_source)
    chunks = split_blocks(blocks, target_words=chunk_words)
    if not chunks:
        raise ValueError("no content found in source document")

    entries: list[manifest_mod.ChunkEntry] = []
    for chunk in chunks:
        src_path = paths["chunks"] / f"{chunk.id}.txt"
        src_path.write_text(chunk.text, encoding="utf-8")
        entries.append(
            manifest_mod.ChunkEntry(
                id=chunk.id,
                status=manifest_mod.STATUS_PENDING,
                source_path=str(src_path.relative_to(paths["root"])),
                translated_path=str(
                    (paths["translated"] / f"{chunk.id}.txt").relative_to(paths["root"])
                ),
                word_count_src=chunk.word_count,
            )
        )

    manifest = manifest_mod.Manifest(
        source_file=str(dest_source.relative_to(paths["root"])),
        chunk_size_target_words=chunk_words,
        model=model,
        chunks=entries,
    )
    manifest_mod.save(manifest, paths["manifest"])
    return manifest


def _tail_words(text: str, n: int) -> str:
    words = text.split()
    return " ".join(words[-n:]) if words else ""


def run_translation(
    project_dir: Path,
    *,
    retry_failed: bool = False,
    on_progress: Optional[Callable[[str, str], None]] = None,
    client=None,
) -> tuple[int, int]:
    """Translate all pending (and optionally errored) chunks.

    Returns (translated_count, error_count).
    """
    from .config import project_paths

    paths = project_paths(project_dir)
    manifest = manifest_mod.load(paths["manifest"])

    style_guide = _load_or_bootstrap_style_guide(paths, manifest, client=client)

    translated = 0
    errored = 0

    for entry in manifest.chunks:
        needs_run = entry.status == manifest_mod.STATUS_PENDING or (
            retry_failed and entry.status == manifest_mod.STATUS_ERROR
        )
        if not needs_run:
            continue

        if on_progress:
            on_progress(entry.id, "translating")

        src_path = paths["root"] / entry.source_path
        translated_path = paths["root"] / entry.translated_path
        arabic_source = src_path.read_text(encoding="utf-8")

        prev_tail = _prev_english_tail(paths, manifest, entry.id)

        effective = glossary_mod.merged(GLOBAL_GLOSSARY_PATH, paths["glossary"])
        glossary_block = glossary_mod.format_for_prompt(effective)

        entry.attempts += 1
        try:
            english = translator_mod.translate_chunk(
                model=manifest.model,
                style_guide=style_guide,
                glossary_block=glossary_block,
                prev_english_tail=prev_tail,
                arabic_source=arabic_source,
                client=client,
            )
        except translator_mod.TranslatorError as e:
            entry.status = manifest_mod.STATUS_ERROR
            entry.last_error = str(e)
            manifest_mod.save(manifest, paths["manifest"])
            errored += 1
            if on_progress:
                on_progress(entry.id, f"error: {e}")
            continue

        translated_path.parent.mkdir(parents=True, exist_ok=True)
        translated_path.write_text(english, encoding="utf-8")

        # Glossary extraction — best-effort; failure here doesn't fail the chunk.
        try:
            new_terms = translator_mod.extract_new_terms(
                model=manifest.model,
                arabic_source=arabic_source,
                english_translation=english,
                existing_terms_block=glossary_block,
                client=client,
            )
            for t in new_terms:
                glossary_mod.add_project_term(
                    project_path=paths["glossary"],
                    arabic=t["ar"],
                    english=t["en"],
                    first_seen=entry.id,
                    global_path=GLOBAL_GLOSSARY_PATH,
                )
        except translator_mod.TranslatorError:
            pass

        entry.status = manifest_mod.STATUS_TRANSLATED
        entry.last_error = None
        manifest_mod.save(manifest, paths["manifest"])
        translated += 1
        if on_progress:
            on_progress(entry.id, "translated")

    return translated, errored


def _load_or_bootstrap_style_guide(paths, manifest, *, client=None) -> str:
    path = paths["style_guide"]
    if path.exists():
        return path.read_text(encoding="utf-8")
    # Bootstrap from the first chunk.
    first = manifest.chunks[0]
    sample = (paths["root"] / first.source_path).read_text(encoding="utf-8")
    try:
        guide = translator_mod.draft_style_guide(
            model=manifest.model, sample_arabic=sample, client=client
        )
    except translator_mod.TranslatorError:
        guide = (
            "# Style Guide\n\n"
            "- Register: neutral formal.\n"
            "- Preserve paragraph structure.\n"
            "- Transliterate proper nouns unless a standard English rendering exists.\n"
        )
    path.write_text(guide, encoding="utf-8")
    return guide


def _prev_english_tail(paths, manifest, current_id: str) -> str:
    idx = next(i for i, e in enumerate(manifest.chunks) if e.id == current_id)
    if idx == 0:
        return ""
    prev = manifest.chunks[idx - 1]
    prev_path = paths["root"] / prev.translated_path
    if not prev_path.exists():
        return ""
    text = prev_path.read_text(encoding="utf-8")
    return _tail_words(text, DEFAULT_CARRY_WORDS)
