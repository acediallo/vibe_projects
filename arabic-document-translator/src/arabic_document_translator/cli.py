"""Command-line interface for the Arabic Document Translator.

This is a starting scaffold. Commands and options will be fleshed out once the
project specifications are finalized.
"""

import argparse
import sys

from . import __version__


def build_parser() -> argparse.ArgumentParser:
    """Construct the top-level argument parser."""
    parser = argparse.ArgumentParser(
        prog="arabic-translate",
        description="Translate documents to and from Arabic.",
    )
    parser.add_argument(
        "--version",
        action="version",
        version=f"%(prog)s {__version__}",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    """Entry point for the CLI."""
    parser = build_parser()
    args = parser.parse_args(argv)  # noqa: F841 — args unused until commands land

    parser.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
