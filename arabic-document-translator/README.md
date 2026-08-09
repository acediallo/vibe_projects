# Arabic Document Translator

A Python CLI tool for translating long Arabic documents to English via the
Claude API. Built as a resumable, chunk-based pipeline: every intermediate
artifact lives on disk, so runs can be interrupted, inspected, hand-edited,
or partially re-run without special tooling.

## Features

- **Chunk-by-chunk translation** — splits at paragraph/heading boundaries,
  never mid-paragraph. Target chunk size is configurable.
- **Resumable** — the manifest is rewritten after every chunk; a crash
  loses at most one in-flight chunk.
- **Glossary layering** — a hand-curated global glossary at
  `~/.translation_pipeline/global_glossary.json` plus an auto-populated,
  per-project glossary. Project entries override globals at prompt-build
  time; nothing is auto-merged on disk.
- **Style guide** — bootstrapped once from a sample chunk, then injected
  verbatim into every translation prompt. Editable by hand mid-run.
- **Context carry-forward** — the last ~150 words of the previous chunk's
  English translation are included as continuity context (never
  re-translated).
- **Assemble & QA** — final `.txt` (and optional `.docx`) output plus an
  optional Claude-driven consistency pass that flags issues rather than
  silently rewriting.

## Requirements

- Python 3.9+
- `ANTHROPIC_API_KEY` in the environment (only needed for `run`, `qa`, and
  automatic style-guide bootstrapping — `init`, `status`, `assemble`, and
  `glossary` commands work offline).

## Installation

```bash
cd arabic-document-translator
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

## Usage

```bash
export ANTHROPIC_API_KEY=sk-ant-...

# 1. Ingest and split a source document.
arabic-translate init path/to/source.docx ./my-project

# 2. Translate all pending chunks (safe to Ctrl-C and re-run).
arabic-translate run ./my-project

# 3. Check progress at any time.
arabic-translate status ./my-project

# 4. Retry chunks that errored.
arabic-translate run ./my-project --retry-failed

# 5. Assemble the final document once every chunk is translated.
arabic-translate assemble ./my-project

# 6. (Optional) Run a consistency pass over the assembled output.
arabic-translate qa ./my-project

# Glossary management
arabic-translate glossary show ./my-project           # merged view
arabic-translate glossary promote ./my-project        # interactive
arabic-translate glossary promote ./my-project --term "الشركة" --yes
```

The default model is `claude-sonnet-5`. Override at `init` time:

```bash
arabic-translate init source.docx ./my-project --model claude-opus-5
```

## Project layout (per translation project)

```
my-project/
├── source/original.docx          # untouched input
├── chunks/chunk_0001.txt         # source-language chunks (Arabic)
├── translated/chunk_0001.txt     # English output (one file per chunk)
├── glossary.json                 # project-local, auto-populated
├── style_guide.md                # editable, injected into every prompt
├── manifest.json                 # source of truth for pipeline state
└── output/
    ├── assembled.txt
    ├── assembled.docx
    ├── assembly_log.json
    └── qa_report.json
```

## Supported input formats

- `.txt` — plain paragraph splitting on blank lines.
- `.docx` — via `python-docx`, preserving paragraph vs heading distinction.

PDF ingestion is intentionally out of scope for v1.

## Development

```bash
pytest        # 26 tests, no network required
```

The Anthropic client is dependency-injected everywhere it's called, so the
end-to-end tests use a fake client and hit no external services.

## Design

See [`translation_pipeline_design.md`](../translation_pipeline_design.md)
for the full design doc this implementation follows.

## License

MIT — see repository root.
