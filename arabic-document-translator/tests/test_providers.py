"""Tests for provider model-spec parsing and factory error handling."""

import pytest

from arabic_document_translator.providers import (
    LLMError,
    get_client,
    parse_model_spec,
)


class TestParseModelSpec:
    def test_explicit_prefix_anthropic(self):
        assert parse_model_spec("anthropic:claude-sonnet-5") == (
            "anthropic",
            "claude-sonnet-5",
        )

    def test_explicit_prefix_openai(self):
        assert parse_model_spec("openai:gpt-4o") == ("openai", "gpt-4o")

    def test_explicit_prefix_google(self):
        assert parse_model_spec("google:gemini-2.0-flash-exp") == (
            "google",
            "gemini-2.0-flash-exp",
        )

    def test_explicit_prefix_openai_compatible(self):
        assert parse_model_spec("openai-compatible:llama-3.1-70b") == (
            "openai-compatible",
            "llama-3.1-70b",
        )

    def test_autodetect_claude(self):
        assert parse_model_spec("claude-sonnet-5") == ("anthropic", "claude-sonnet-5")

    def test_autodetect_gpt(self):
        assert parse_model_spec("gpt-4o") == ("openai", "gpt-4o")

    def test_autodetect_o1(self):
        assert parse_model_spec("o1-mini") == ("openai", "o1-mini")

    def test_autodetect_gemini(self):
        assert parse_model_spec("gemini-2.0-flash-exp") == (
            "google",
            "gemini-2.0-flash-exp",
        )

    def test_unknown_bare_name_falls_back_to_default(self):
        # Default is anthropic — keeps existing behaviour for unknown names.
        provider, model = parse_model_spec("some-custom-name")
        assert provider == "anthropic"
        assert model == "some-custom-name"

    def test_prefix_is_case_insensitive(self):
        assert parse_model_spec("OpenAI:gpt-4o") == ("openai", "gpt-4o")

    def test_model_id_can_contain_slashes(self):
        # OpenRouter-style IDs after the colon
        assert parse_model_spec("openai-compatible:anthropic/claude-3.5-sonnet") == (
            "openai-compatible",
            "anthropic/claude-3.5-sonnet",
        )


class TestGetClient:
    def test_unknown_provider_raises(self):
        with pytest.raises(LLMError, match="unknown provider"):
            get_client("nosuch:foo")

    def test_openai_compatible_requires_base_url(self, monkeypatch):
        # Skip if openai isn't installed — we're testing the URL check, not the SDK.
        pytest.importorskip("openai")
        monkeypatch.delenv("OPENAI_COMPATIBLE_BASE_URL", raising=False)
        with pytest.raises(LLMError, match="OPENAI_COMPATIBLE_BASE_URL"):
            get_client("openai-compatible:some-model")

    def test_google_requires_api_key(self, monkeypatch):
        # Skip if google-genai isn't installed — we're testing the key check,
        # not the SDK.
        pytest.importorskip("google.genai")
        monkeypatch.delenv("GEMINI_API_KEY", raising=False)
        monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
        with pytest.raises(LLMError, match="GEMINI_API_KEY"):
            get_client("google:gemini-2.0-flash-exp")
