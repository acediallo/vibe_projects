"""Smoke tests for the CLI entry point."""

import pytest

from arabic_document_translator import __version__
from arabic_document_translator.cli import build_parser


def test_version_string():
    assert __version__ == "0.1.0"


def test_parser_builds():
    parser = build_parser()
    assert parser.prog == "arabic-translate"


def test_version_flag_exits_zero(capsys):
    from arabic_document_translator.cli import main
    with pytest.raises(SystemExit) as exc:
        main(["--version"])
    assert exc.value.code == 0
    assert __version__ in capsys.readouterr().out


def test_missing_subcommand_errors(capsys):
    from arabic_document_translator.cli import main
    with pytest.raises(SystemExit):
        main([])
