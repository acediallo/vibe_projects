"""Basic smoke tests for the CLI scaffold."""

import pytest

from arabic_document_translator import __version__
from arabic_document_translator.cli import build_parser, main


def test_version_string():
    assert __version__ == "0.1.0"


def test_parser_builds():
    parser = build_parser()
    assert parser.prog == "arabic-translate"


def test_main_runs_with_no_args():
    assert main([]) == 0


def test_version_flag_exits_zero(capsys):
    with pytest.raises(SystemExit) as exc:
        main(["--version"])
    assert exc.value.code == 0
    assert __version__ in capsys.readouterr().out
