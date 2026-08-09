# Arabic Document Translator

A Python CLI that translates long Arabic documents (100+ pages) into English
using the Claude API — chunk by chunk, resumably, with a shared glossary
and style guide that keep terminology and tone consistent across the whole
document.

## Why this exists

LLMs translate short passages beautifully but drift when handed a whole
book: the same proper noun ends up rendered three different ways,
tone shifts between chapters, and if the run crashes at page 60 you've
wasted the first 59. This tool solves those three problems:

1. **Consistency** — a persistent glossary (global + project-local) is
   injected into every translation prompt, so `الشركة` always translates
   the same way.
2. **Coherence** — each prompt carries the last ~150 words of the previous
   chunk's English translation as continuity context (pronouns, tense,
   register).
3. **Resumability** — every chunk is a standalone file on disk, and
   `manifest.json` is rewritten atomically after each chunk. Kill the
   process at chunk 40/80, run the same command again, and it continues
   from chunk 41.

## Requirements

- Python 3.9+
- `ANTHROPIC_API_KEY` in your environment (only needed for `run` and `qa`
  — `init`, `status`, `assemble`, and `glossary` work offline)

## Install

```bash
cd arabic-document-translator
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

Verify the install:

```bash
arabic-translate --version
# → arabic-translate 0.1.0
```

## Supported input formats

- **`.txt`** — plain paragraph splitting on blank lines
- **`.docx`** — via `python-docx`; preserves paragraph vs heading distinction

PDF is intentionally out of scope for v1.

## The five-command workflow

The tool is stateless between invocations — every command reads
`manifest.json`, does its work, writes back to disk, and exits. You can
stop and resume freely.

### 1. `init` — ingest and split

```bash
arabic-translate init path/to/source.docx ./my-project
```

Creates `./my-project/` with the source copied in, chunked source files
under `chunks/`, and a `manifest.json` listing each chunk as `pending`.

**Successful outcome:**
```
Initialised project at ./my-project (47 chunk(s), model=claude-sonnet-5).
```

Options:
- `--model claude-opus-5` — override the default (`claude-sonnet-5`).
  Stored in `manifest.json` so subsequent `run`s use the same model.
- `--chunk-words 1200` — target words per chunk (default: 1500).

### 2. `run` — translate pending chunks

```bash
export ANTHROPIC_API_KEY=sk-ant-...
arabic-translate run ./my-project
```

Translates every `pending` chunk in order. Prints one line per chunk. Safe
to `Ctrl-C` and re-run — it picks up where it left off.

**Successful outcome:**
```
  chunk_0001: translating
  chunk_0001: translated
  chunk_0002: translating
  chunk_0002: translated
  ...
Done. translated=47 errored=0
```

If any chunk hits an API error, it's marked `status: error` in the
manifest with the exception message. The run continues to the next chunk
and exits with code `2`. Fix or wait, then:

```bash
arabic-translate run ./my-project --retry-failed
```

### 3. `status` — check progress

```bash
arabic-translate status ./my-project
```

**Successful outcome (mid-run):**
```
Project: ./my-project
Source:  source/source.docx
Model:   claude-sonnet-5
Chunks:  47
  pending    12
  translated 34
  error      1

Errored chunks:
  chunk_0023 (attempts=3): overloaded_error: 529
```

### 4. `assemble` — build the final document

```bash
arabic-translate assemble ./my-project
```

Refuses to run until every chunk is `translated`. Concatenates
`translated/*.txt` in document order and writes:

- `output/assembled.txt`
- `output/assembled.docx` (unless `--no-docx`)
- `output/assembly_log.json` — records which chunk file was used and its
  mtime (so you can verify the assembled output reflects any hand-edits)

**Successful outcome:**
```
Assembled 47 chunk(s) into my-project/output/assembled.txt
Also wrote my-project/output/assembled.docx
```

### 5. `qa` — optional consistency review

```bash
arabic-translate qa ./my-project
```

Runs a single Claude call over the assembled document that flags (does
not rewrite) terminology inconsistencies, abrupt tone shifts, and broken
sentences at former chunk boundaries. Writes `output/qa_report.json`.

**Successful outcome:**
```
QA report saved to my-project/output/qa_report.json
2 issue(s) flagged.
  [1] (terminology) "the Company" and "the Firm" both used for الشركة
  [2] (tone) abrupt shift to colloquial register mid-paragraph
```

## Glossary commands

Two glossary files exist at different trust levels:

- **`~/.translation_pipeline/global_glossary.json`** — hand-curated,
  shared across every project. Never auto-written.
- **`<project>/glossary.json`** — auto-populated as new terms are
  discovered during `run`. Sandboxed to the project.

At prompt-build time they're merged into an effective glossary; **project
entries override globals** for the same Arabic key. This lets one project
override a shared default (e.g., "the Firm" instead of the global
"the Company") without ever touching the shared file.

```bash
# See the merged effective glossary
arabic-translate glossary show ./my-project

# Interactively promote project terms into the global glossary
arabic-translate glossary promote ./my-project

# Promote a single term without prompting
arabic-translate glossary promote ./my-project --term "الشركة" --yes
```

## Project layout

```
my-project/
├── source/original.docx          untouched input, copied at init time
├── chunks/chunk_0001.txt         Arabic source, one file per chunk
├── translated/chunk_0001.txt     English output, written as each chunk finishes
├── glossary.json                 project-local terms, auto-populated
├── style_guide.md                bootstrapped from chunk 1, editable by hand
├── manifest.json                 source of truth for pipeline state
└── output/
    ├── assembled.txt
    ├── assembled.docx
    ├── assembly_log.json
    └── qa_report.json
```

You can open, diff, or hand-edit any chunk between `run` and `assemble`
— presence of a file *is* the state signal, backed by the manifest for
richer status.

## Editing mid-run

- **Style guide** (`style_guide.md`) — edit at any time; the next `run`
  picks up the new version.
- **Project glossary** (`glossary.json`) — hand-edit to correct a
  translation; subsequent chunks see the corrected entry.
- **A single chunk** (`translated/chunk_0023.txt`) — delete it and set
  its status back to `pending` in `manifest.json`, then rerun. Or just
  edit the file — `assemble` will pick up whatever's there.

## Testing

The full test suite runs offline (no API key needed, no network calls —
the Anthropic client is dependency-injected and the end-to-end tests use
a fake client):

```bash
pytest
# → 26 passed
```

To try the tool end-to-end without spending API credits, run only the
offline commands:

```bash
printf "الفقرة الأولى.\n\nالفقرة الثانية.\n" > /tmp/sample.txt
arabic-translate init /tmp/sample.txt /tmp/demo --chunk-words 5
arabic-translate status /tmp/demo
arabic-translate glossary show /tmp/demo
```

For a real translation, add `arabic-translate run /tmp/demo` after
exporting `ANTHROPIC_API_KEY`.

## Design

Full design doc: [`translation_pipeline_design.md`](../translation_pipeline_design.md)

## License

MIT — see repository root.
