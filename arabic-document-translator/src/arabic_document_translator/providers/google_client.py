"""Google Gemini provider adapter (google-genai SDK).

Environment variable: ``GEMINI_API_KEY`` (also accepts ``GOOGLE_API_KEY``).
"""

from __future__ import annotations

import os

from .base import LLMClient, LLMError


class GoogleClient(LLMClient):
    def __init__(self, model: str):
        try:
            from google import genai
        except ImportError as e:  # pragma: no cover - depends on install
            raise LLMError(
                "google-genai package not installed. "
                "Run: pip install \"arabic-document-translator[google]\" "
                "(or: pip install google-genai)"
            ) from e

        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            raise LLMError(
                "google provider requires GEMINI_API_KEY (or GOOGLE_API_KEY) to be set."
            )
        self.model = model
        self._client = genai.Client(api_key=api_key)
        self._types = __import__("google.genai.types", fromlist=["types"])

    def complete(self, *, system: str, user: str, max_tokens: int) -> str:
        config = self._types.GenerateContentConfig(
            system_instruction=system,
            max_output_tokens=max_tokens,
        )
        resp = self._client.models.generate_content(
            model=self.model,
            contents=user,
            config=config,
        )
        text = getattr(resp, "text", None) or ""
        return text.strip()
