#!/usr/bin/env python3
"""Thin launcher so you can run `./ytdl.py video <url>` from this folder."""
import sys
from ytdl.cli import main

if __name__ == "__main__":
    sys.exit(main())
