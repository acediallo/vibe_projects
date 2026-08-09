"""Command-line interface for arabic-translate.

Subcommands (design doc §13):
    init      <source_file> <project_dir>
    run       <project_dir> [--retry-failed]
    status    <project_dir>
    assemble  <project_dir> [--no-docx]
    qa        <project_dir>
    glossary  show     <project_dir>
    glossary  promote  <project_dir> [--term X] [--yes]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from . import __version__
from . import glossary as glossary_mod
from . import manifest as manifest_mod
from . import pipeline as pipeline_mod
from .assembler import AssemblyError, assemble
from .config import (
    DEFAULT_CHUNK_WORDS,
    DEFAULT_MODEL,
    GLOBAL_GLOSSARY_PATH,
    project_paths,
)
from .qa import QAError, run_qa


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="arabic-translate",
        description="Translate Arabic documents to English via the Claude API.",
    )
    parser.add_argument(
        "--version", action="version", version=f"%(prog)s {__version__}"
    )
    sub = parser.add_subparsers(dest="command", metavar="COMMAND")
    sub.required = True

    p_init = sub.add_parser("init", help="Ingest and split a source document.")
    p_init.add_argument("source_file", type=Path)
    p_init.add_argument("project_dir", type=Path)
    p_init.add_argument(
        "--model", default=DEFAULT_MODEL,
        help=f"Claude model to use (default: {DEFAULT_MODEL})",
    )
    p_init.add_argument(
        "--chunk-words", type=int, default=DEFAULT_CHUNK_WORDS,
        help=f"Target words per chunk (default: {DEFAULT_CHUNK_WORDS})",
    )
    p_init.set_defaults(func=cmd_init)

    p_run = sub.add_parser("run", help="Translate all pending chunks.")
    p_run.add_argument("project_dir", type=Path)
    p_run.add_argument(
        "--retry-failed", action="store_true",
        help="Also retry chunks whose status is 'error'.",
    )
    p_run.set_defaults(func=cmd_run)

    p_status = sub.add_parser("status", help="Show manifest summary.")
    p_status.add_argument("project_dir", type=Path)
    p_status.set_defaults(func=cmd_status)

    p_asm = sub.add_parser("assemble", help="Build the final output document.")
    p_asm.add_argument("project_dir", type=Path)
    p_asm.add_argument(
        "--no-docx", action="store_true", help="Skip .docx output."
    )
    p_asm.set_defaults(func=cmd_assemble)

    p_qa = sub.add_parser("qa", help="Run a consistency pass over the assembled document.")
    p_qa.add_argument("project_dir", type=Path)
    p_qa.set_defaults(func=cmd_qa)

    p_gloss = sub.add_parser("glossary", help="Inspect or promote glossary entries.")
    gsub = p_gloss.add_subparsers(dest="glossary_command", metavar="SUBCOMMAND")
    gsub.required = True

    p_gshow = gsub.add_parser("show", help="Print the effective merged glossary.")
    p_gshow.add_argument("project_dir", type=Path)
    p_gshow.set_defaults(func=cmd_glossary_show)

    p_gprom = gsub.add_parser("promote", help="Promote project terms into the global glossary.")
    p_gprom.add_argument("project_dir", type=Path)
    p_gprom.add_argument(
        "--term", help="Promote just this Arabic term.",
    )
    p_gprom.add_argument(
        "--yes", action="store_true",
        help="Skip interactive prompts and promote all project terms.",
    )
    p_gprom.set_defaults(func=cmd_glossary_promote)

    return parser


def cmd_init(args: argparse.Namespace) -> int:
    manifest = pipeline_mod.init_project(
        source_file=args.source_file,
        project_dir=args.project_dir,
        model=args.model,
        chunk_words=args.chunk_words,
    )
    print(
        f"Initialised project at {args.project_dir} "
        f"({len(manifest.chunks)} chunk(s), model={manifest.model})."
    )
    return 0


def cmd_run(args: argparse.Namespace) -> int:
    def on_progress(chunk_id: str, state: str) -> None:
        print(f"  {chunk_id}: {state}")

    translated, errored = pipeline_mod.run_translation(
        args.project_dir,
        retry_failed=args.retry_failed,
        on_progress=on_progress,
    )
    print(f"Done. translated={translated} errored={errored}")
    return 0 if errored == 0 else 2


def cmd_status(args: argparse.Namespace) -> int:
    paths = project_paths(args.project_dir)
    manifest = manifest_mod.load(paths["manifest"])
    counts: dict[str, int] = {}
    for c in manifest.chunks:
        counts[c.status] = counts.get(c.status, 0) + 1
    print(f"Project: {args.project_dir}")
    print(f"Source:  {manifest.source_file}")
    print(f"Model:   {manifest.model}")
    print(f"Chunks:  {len(manifest.chunks)}")
    for status in ("pending", "translated", "assembled", "error"):
        if status in counts:
            print(f"  {status:<10} {counts[status]}")
    errors = [c for c in manifest.chunks if c.status == manifest_mod.STATUS_ERROR]
    if errors:
        print("\nErrored chunks:")
        for c in errors:
            print(f"  {c.id} (attempts={c.attempts}): {c.last_error}")
    return 0


def cmd_assemble(args: argparse.Namespace) -> int:
    try:
        log = assemble(args.project_dir, make_docx=not args.no_docx)
    except AssemblyError as e:
        print(f"assemble failed: {e}", file=sys.stderr)
        return 2
    paths = project_paths(args.project_dir)
    print(f"Assembled {log['chunk_count']} chunk(s) into {paths['assembled_txt']}")
    if log["docx_written"]:
        print(f"Also wrote {paths['assembled_docx']}")
    return 0


def cmd_qa(args: argparse.Namespace) -> int:
    try:
        report = run_qa(args.project_dir)
    except QAError as e:
        print(f"qa failed: {e}", file=sys.stderr)
        return 2
    issues = report.get("issues", [])
    paths = project_paths(args.project_dir)
    print(f"QA report saved to {paths['qa_report']}")
    print(f"{len(issues)} issue(s) flagged.")
    for i, issue in enumerate(issues, 1):
        kind = issue.get("kind", "?")
        note = issue.get("note", "")
        print(f"  [{i}] ({kind}) {note}")
    return 0


def cmd_glossary_show(args: argparse.Namespace) -> int:
    paths = project_paths(args.project_dir)
    effective = glossary_mod.merged(GLOBAL_GLOSSARY_PATH, paths["glossary"])
    if not effective:
        print("(glossary is empty)")
        return 0
    print(f"Effective glossary ({len(effective)} term(s)):")
    for ar, entry in sorted(effective.items()):
        source = entry.get("source", "?")
        print(f"  {ar}  →  {entry.get('en', '')}   [{source}]")
    return 0


def cmd_glossary_promote(args: argparse.Namespace) -> int:
    paths = project_paths(args.project_dir)
    project = glossary_mod.load_project(paths["glossary"]).get("terms", {})
    if not project:
        print("Project glossary is empty — nothing to promote.")
        return 0

    global_data = glossary_mod.load_global(GLOBAL_GLOSSARY_PATH)
    global_data.setdefault("terms", {})

    candidates: list[str] = []
    if args.term:
        if args.term not in project:
            print(f"No such project term: {args.term}", file=sys.stderr)
            return 2
        candidates = [args.term]
    else:
        candidates = sorted(project.keys())

    promoted = 0
    for ar in candidates:
        entry = project[ar]
        en = entry.get("en", "")
        prompt = f"Promote  {ar}  →  {en}  ? [y/N] "
        if args.yes:
            answer = "y"
        else:
            try:
                answer = input(prompt).strip().lower()
            except EOFError:
                answer = ""
        if answer != "y":
            continue
        global_data["terms"][ar] = {"en": en, "source": "global"}
        promoted += 1

    if promoted:
        GLOBAL_GLOSSARY_PATH.parent.mkdir(parents=True, exist_ok=True)
        with GLOBAL_GLOSSARY_PATH.open("w", encoding="utf-8") as fh:
            json.dump(global_data, fh, ensure_ascii=False, indent=2)
    print(f"Promoted {promoted} term(s) to {GLOBAL_GLOSSARY_PATH}")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
