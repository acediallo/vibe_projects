"""Claude API client wrapper: translate a chunk, extract new terms, draft a
style guide, run QA."""

from __future__ import annotations

import json
import re
import time
from typing import Optional

from . import prompts
from .config import DEFAULT_MAX_RETRIES


class TranslatorError(RuntimeError):
    pass


def _get_client():
    try:
        from anthropic import Anthropic
    except ImportError as e:  # pragma: no cover - depends on install
        raise TranslatorError(
            "anthropic package not installed. Run: pip install anthropic"
        ) from e
    return Anthropic()


def _extract_text(response) -> str:
    parts = []
    for block in response.content:
        text = getattr(block, "text", None)
        if text:
            parts.append(text)
    return "".join(parts).strip()


def _call_with_retry(
    client,
    *,
    model: str,
    system: str,
    user: str,
    max_tokens: int,
    max_retries: int = DEFAULT_MAX_RETRIES,
) -> str:
    last_exc: Optional[Exception] = None
    for attempt in range(1, max_retries + 1):
        try:
            resp = client.messages.create(
                model=model,
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": "user", "content": user}],
            )
            return _extract_text(resp)
        except Exception as e:  # network, rate-limit, server errors
            last_exc = e
            if attempt == max_retries:
                break
            time.sleep(2 ** attempt)
    raise TranslatorError(f"API call failed after {max_retries} attempts: {last_exc}")


def translate_chunk(
    *,
    model: str,
    style_guide: str,
    glossary_block: str,
    prev_english_tail: str,
    arabic_source: str,
    max_retries: int = DEFAULT_MAX_RETRIES,
    client=None,
) -> str:
    client = client or _get_client()
    user = prompts.build_translation_user_prompt(
        style_guide=style_guide,
        glossary_block=glossary_block,
        prev_english_tail=prev_english_tail,
        arabic_source=arabic_source,
    )
    return _call_with_retry(
        client,
        model=model,
        system=prompts.TRANSLATION_SYSTEM,
        user=user,
        max_tokens=8192,
        max_retries=max_retries,
    )


_JSON_BLOCK_RE = re.compile(r"\{.*\}", re.DOTALL)


def _parse_json_response(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
    match = _JSON_BLOCK_RE.search(text)
    if not match:
        raise TranslatorError(f"could not find JSON object in response: {text[:200]}")
    return json.loads(match.group(0))


def extract_new_terms(
    *,
    model: str,
    arabic_source: str,
    english_translation: str,
    existing_terms_block: str,
    max_retries: int = DEFAULT_MAX_RETRIES,
    client=None,
) -> list[dict]:
    client = client or _get_client()
    user = prompts.build_glossary_extraction_prompt(
        arabic_source=arabic_source,
        english_translation=english_translation,
        existing_terms_block=existing_terms_block,
    )
    raw = _call_with_retry(
        client,
        model=model,
        system=prompts.GLOSSARY_EXTRACTION_SYSTEM,
        user=user,
        max_tokens=2048,
        max_retries=max_retries,
    )
    try:
        data = _parse_json_response(raw)
    except (TranslatorError, json.JSONDecodeError):
        return []
    terms = data.get("new_terms", []) or []
    cleaned: list[dict] = []
    for t in terms:
        ar = (t.get("ar") or "").strip()
        en = (t.get("en") or "").strip()
        if ar and en:
            cleaned.append({"ar": ar, "en": en})
    return cleaned


def draft_style_guide(
    *,
    model: str,
    sample_arabic: str,
    max_retries: int = DEFAULT_MAX_RETRIES,
    client=None,
) -> str:
    client = client or _get_client()
    return _call_with_retry(
        client,
        model=model,
        system=prompts.STYLE_GUIDE_BOOTSTRAP_SYSTEM,
        user=prompts.build_style_guide_prompt(sample_arabic),
        max_tokens=1024,
        max_retries=max_retries,
    )


def qa_review(
    *,
    model: str,
    assembled_english: str,
    glossary_block: str,
    max_retries: int = DEFAULT_MAX_RETRIES,
    client=None,
) -> dict:
    client = client or _get_client()
    raw = _call_with_retry(
        client,
        model=model,
        system=prompts.QA_SYSTEM,
        user=prompts.build_qa_prompt(assembled_english, glossary_block),
        max_tokens=4096,
        max_retries=max_retries,
    )
    try:
        return _parse_json_response(raw)
    except (TranslatorError, json.JSONDecodeError):
        return {"issues": [], "raw": raw}
