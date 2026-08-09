"""Anthropic (Claude) provider adapter."""

from __future__ import annotations

from .base import LLMClient, LLMError


class AnthropicClient(LLMClient):
    """Wraps the ``anthropic`` Python SDK."""

    def __init__(self, model: str):
        try:
            from anthropic import Anthropic
        except ImportError as e:  # pragma: no cover - depends on install
            raise LLMError(
                "anthropic package not installed. Run: pip install anthropic"
            ) from e
        self.model = model
        self._client = Anthropic()

    def complete(self, *, system: str, user: str, max_tokens: int) -> str:
        resp = self._client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        parts = []
        for block in resp.content:
            text = getattr(block, "text", None)
            if text:
                parts.append(text)
        return "".join(parts).strip()
