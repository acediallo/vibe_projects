"""Idempotency store: maps a Zoho id to the Odoo id we created for it.

The migration is designed to be safe to re-run. Before creating anything in
Odoo we consult this map; if the Zoho id has already been transferred we skip
or update-in-place instead of duplicating.
"""
from __future__ import annotations

import json
import threading
from pathlib import Path


class Mapping:
    def __init__(self, path: str | Path = "state.json") -> None:
        self.path = Path(path)
        self._lock = threading.Lock()
        self._data: dict[str, dict[str, int]] = {}
        if self.path.exists():
            with self.path.open() as fh:
                self._data = json.load(fh)

    def get(self, kind: str, zoho_id: str) -> int | None:
        return self._data.get(kind, {}).get(zoho_id)

    def set(self, kind: str, zoho_id: str, odoo_id: int) -> None:
        with self._lock:
            self._data.setdefault(kind, {})[zoho_id] = odoo_id
            self._flush()

    def count(self, kind: str) -> int:
        return len(self._data.get(kind, {}))

    def _flush(self) -> None:
        tmp = self.path.with_suffix(".tmp")
        with tmp.open("w") as fh:
            json.dump(self._data, fh, indent=2, sort_keys=True)
        tmp.replace(self.path)
