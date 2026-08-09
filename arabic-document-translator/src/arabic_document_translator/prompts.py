"""Prompt templates for translation, style-guide bootstrap, and QA."""

from __future__ import annotations

TRANSLATION_SYSTEM = (
    "You are a professional Arabic-to-English translator. Produce a faithful, "
    "fluent English translation of the provided source text. Preserve paragraph "
    "structure. Do not add commentary, explanations, or notes — output only the "
    "translation itself, in English."
)


def build_translation_user_prompt(
    style_guide: str,
    glossary_block: str,
    prev_english_tail: str,
    arabic_source: str,
) -> str:
    return f"""STYLE GUIDE
-----------
{style_guide}

GLOSSARY (use these translations for the listed Arabic terms — project entries override globals)
{glossary_block}

PREVIOUS ENGLISH CONTEXT (for continuity of tone/pronouns/tense only — DO NOT re-translate this)
{prev_english_tail if prev_english_tail else "(this is the first chunk)"}

ARABIC SOURCE TO TRANSLATE
{arabic_source}

Return ONLY the English translation of the Arabic source above. No preamble."""


GLOSSARY_EXTRACTION_SYSTEM = (
    "You extract proper nouns and specialised technical terms from an "
    "Arabic-to-English translation pair. Output strict JSON only."
)


def build_glossary_extraction_prompt(
    arabic_source: str,
    english_translation: str,
    existing_terms_block: str,
) -> str:
    return f"""Below is an Arabic source chunk and its English translation.

Identify any proper nouns, organisation names, place names, or specialised
technical terms that appear in this chunk AND are not already in the
existing glossary. Only list terms whose English rendering should be
consistent across the rest of the document.

EXISTING GLOSSARY (do not repeat)
{existing_terms_block}

ARABIC SOURCE
{arabic_source}

ENGLISH TRANSLATION
{english_translation}

Respond with strict JSON of the form:
{{"new_terms": [{{"ar": "...", "en": "..."}}, ...]}}
If there are no new terms, respond with {{"new_terms": []}}."""


STYLE_GUIDE_BOOTSTRAP_SYSTEM = (
    "You are helping a translator draft a short style guide for an "
    "Arabic-to-English document translation project."
)


def build_style_guide_prompt(sample_arabic: str) -> str:
    return f"""Below is a sample from an Arabic document that will be translated
into English. Draft a concise (under 200 words) style guide covering:
- Register / formality (formal, neutral, colloquial)
- Handling of honorifics and religious phrases (if any)
- Tense conventions (past narrative vs present)
- How to treat proper nouns (transliterate vs translate)
- Any obvious domain-specific notes

SAMPLE
{sample_arabic}

Output the style guide as plain markdown. No preamble."""


QA_SYSTEM = (
    "You are a quality reviewer for an Arabic-to-English translation. "
    "You do NOT rewrite the text — you only flag potential issues. "
    "Output strict JSON only."
)


def build_qa_prompt(assembled_english: str, glossary_block: str) -> str:
    return f"""Review the assembled English translation below for:
1. Terminology inconsistencies (same Arabic concept translated differently)
2. Abrupt tone or register shifts (likely former chunk boundaries)
3. Obviously broken or ungrammatical sentences

GLOSSARY (the intended canonical renderings)
{glossary_block}

ASSEMBLED ENGLISH TRANSLATION
{assembled_english}

Respond with strict JSON of the form:
{{"issues": [{{"kind": "terminology|tone|grammar", "excerpt": "...",
              "note": "..."}}]}}
If no issues, return {{"issues": []}}."""
