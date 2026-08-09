"""Provider-agnostic LLM client layer.

Model spec format: ``provider:model_id`` where provider is one of
``anthropic``, ``openai``, ``google``, or ``openai-compatible``. A bare
model name is auto-routed by prefix (``claude-*`` → anthropic, ``gpt-*``
or ``o1``/``o3``/``o4`` → openai, ``gemini-*`` → google). If the prefix
is unrecognised, the default provider (anthropic) is used.
"""

from __future__ import annotations

from .base import LLMClient, LLMError

__all__ = ["LLMClient", "LLMError", "get_client", "parse_model_spec"]


DEFAULT_PROVIDER = "anthropic"


def parse_model_spec(spec: str) -> tuple[str, str]:
    """Split a model spec into (provider, model_id).

    Accepts:
      - "anthropic:claude-sonnet-5"       → ("anthropic", "claude-sonnet-5")
      - "openai:gpt-4o"                   → ("openai", "gpt-4o")
      - "google:gemini-2.0-flash-exp"     → ("google", "gemini-2.0-flash-exp")
      - "openai-compatible:llama-3.1-70b" → ("openai-compatible", "llama-3.1-70b")
      - "claude-sonnet-5"                 → ("anthropic", "claude-sonnet-5")
      - "gpt-4o"                          → ("openai", "gpt-4o")
      - "gemini-2.0-flash-exp"            → ("google", "gemini-2.0-flash-exp")
    """
    spec = spec.strip()
    if ":" in spec:
        provider, model = spec.split(":", 1)
        return provider.strip().lower(), model.strip()

    low = spec.lower()
    if low.startswith("claude"):
        return "anthropic", spec
    if low.startswith(("gpt-", "gpt", "o1", "o3", "o4")):
        return "openai", spec
    if low.startswith("gemini"):
        return "google", spec
    return DEFAULT_PROVIDER, spec


def get_client(model_spec: str) -> LLMClient:
    """Return an LLMClient bound to the model_id parsed from ``model_spec``."""
    provider, model_id = parse_model_spec(model_spec)

    if provider == "anthropic":
        from .anthropic_client import AnthropicClient
        return AnthropicClient(model=model_id)
    if provider == "openai":
        from .openai_client import OpenAIClient
        return OpenAIClient(model=model_id)
    if provider == "openai-compatible":
        from .openai_client import OpenAIClient
        return OpenAIClient(model=model_id, openai_compatible=True)
    if provider == "google":
        from .google_client import GoogleClient
        return GoogleClient(model=model_id)

    raise LLMError(
        f"unknown provider {provider!r}. "
        "Supported: anthropic, openai, openai-compatible, google."
    )
