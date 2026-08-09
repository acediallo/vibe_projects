"""OpenAI provider adapter.

Also handles ``openai-compatible`` endpoints (OpenRouter, Together AI,
Fireworks, local vLLM/Ollama, etc.) by pointing the OpenAI SDK at a
custom base URL.

Environment variables:
- ``OPENAI_API_KEY`` — standard OpenAI usage.
- ``OPENAI_COMPATIBLE_BASE_URL`` + ``OPENAI_COMPATIBLE_API_KEY`` — used
  when the provider is ``openai-compatible``.
"""

from __future__ import annotations

import os

from .base import LLMClient, LLMError


class OpenAIClient(LLMClient):
    def __init__(self, model: str, openai_compatible: bool = False):
        try:
            from openai import OpenAI
        except ImportError as e:  # pragma: no cover - depends on install
            raise LLMError(
                "openai package not installed. "
                "Run: pip install \"arabic-document-translator[openai]\" "
                "(or: pip install openai)"
            ) from e
        self.model = model

        if openai_compatible:
            base_url = os.environ.get("OPENAI_COMPATIBLE_BASE_URL")
            if not base_url:
                raise LLMError(
                    "openai-compatible provider requires OPENAI_COMPATIBLE_BASE_URL "
                    "to be set (e.g. https://openrouter.ai/api/v1)."
                )
            api_key = (
                os.environ.get("OPENAI_COMPATIBLE_API_KEY")
                or os.environ.get("OPENAI_API_KEY")
                or "sk-not-required"  # some local servers don't require a key
            )
            self._client = OpenAI(base_url=base_url, api_key=api_key)
        else:
            self._client = OpenAI()

    def complete(self, *, system: str, user: str, max_tokens: int) -> str:
        resp = self._client.chat.completions.create(
            model=self.model,
            max_tokens=max_tokens,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        )
        text = resp.choices[0].message.content or ""
        return text.strip()
