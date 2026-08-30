"""Thin Odoo XML-RPC client with the ergonomics used by this migration."""
from __future__ import annotations

import logging
import xmlrpc.client
from typing import Any

log = logging.getLogger(__name__)


class OdooClient:
    def __init__(self, url: str, db: str, username: str, api_key: str) -> None:
        self.url = url.rstrip("/")
        self.db = db
        self.username = username
        self.api_key = api_key
        self._common = xmlrpc.client.ServerProxy(f"{self.url}/xmlrpc/2/common", allow_none=True)
        self._models = xmlrpc.client.ServerProxy(f"{self.url}/xmlrpc/2/object", allow_none=True)
        self.uid: int = self._common.authenticate(self.db, self.username, self.api_key, {})
        if not self.uid:
            raise RuntimeError("Odoo authentication failed - check URL, DB, user, and API key")

    def execute(self, model: str, method: str, args: list, kwargs: dict | None = None) -> Any:
        return self._models.execute_kw(self.db, self.uid, self.api_key, model, method, args, kwargs or {})

    # -- convenience wrappers -------------------------------------------------
    def search_read(self, model: str, domain: list, fields: list[str], limit: int | None = None) -> list[dict]:
        kw: dict = {"fields": fields}
        if limit is not None:
            kw["limit"] = limit
        return self.execute(model, "search_read", [domain], kw)

    def find_one(self, model: str, domain: list, fields: list[str] | None = None) -> dict | None:
        rows = self.search_read(model, domain, fields or ["id"], limit=1)
        return rows[0] if rows else None

    def create(self, model: str, values: dict) -> int:
        return self.execute(model, "create", [values])

    def write(self, model: str, ids: list[int], values: dict) -> bool:
        return self.execute(model, "write", [ids, values])

    def name_get(self, model: str, ids: list[int]) -> list[tuple[int, str]]:
        return self.execute(model, "name_get", [ids])

    # -- typed helpers used across the migration ------------------------------
    def country_id(self, code: str | None) -> int | None:
        if not code:
            return None
        row = self.find_one("res.country", [("code", "=", code.upper())])
        return row["id"] if row else None

    def currency_id(self, code: str | None) -> int | None:
        if not code:
            return None
        row = self.find_one("res.currency", [("name", "=", code.upper())])
        return row["id"] if row else None

    def uom_id(self, name: str | None) -> int:
        if name:
            row = self.find_one("uom.uom", [("name", "=ilike", name)])
            if row:
                return row["id"]
        # Fall back to Odoo's default "Units" UoM.
        row = self.find_one("uom.uom", [("name", "=", "Units")])
        return row["id"] if row else 1
