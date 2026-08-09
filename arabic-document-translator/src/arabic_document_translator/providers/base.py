"""Abstract LLM client contract used by the translator."""

from __future__ import annotations

from abc import ABC, abstractmethod


class LLMError(RuntimeError):
    """Raised for provider-layer configuration or dispatch errors."""


class LLMClient(ABC):
    """Minimal interface every provider must implement.

    A single blocking call: pass a system prompt, a user prompt, and a
    max_tokens ceiling; get back the concatenated text of the response.
    Retries and backoff live one level up in ``translator._call_with_retry``.
    """

    model: str

    @abstractmethod
    def complete(self, *, system: str, user: str, max_tokens: int) -> str:
        """Send one prompt to the provider and return the response text."""
