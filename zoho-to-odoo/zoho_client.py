"""Thin Zoho Invoice REST client: OAuth refresh, pagination, throttling."""
from __future__ import annotations

import logging
import time
from typing import Any, Iterator

import requests

log = logging.getLogger(__name__)

ACCOUNTS_HOST = {
    "com": "https://accounts.zoho.com",
    "eu": "https://accounts.zoho.eu",
    "in": "https://accounts.zoho.in",
    "com.au": "https://accounts.zoho.com.au",
    "jp": "https://accounts.zoho.jp",
    "ca": "https://accounts.zohocloud.ca",
    "sa": "https://accounts.zoho.sa",
}
API_HOST = {
    "com": "https://www.zohoapis.com",
    "eu": "https://www.zohoapis.eu",
    "in": "https://www.zohoapis.in",
    "com.au": "https://www.zohoapis.com.au",
    "jp": "https://www.zohoapis.jp",
    "ca": "https://www.zohoapis.ca",
    "sa": "https://www.zohoapis.sa",
}


class ZohoInvoiceClient:
    def __init__(
        self,
        client_id: str,
        client_secret: str,
        refresh_token: str,
        organization_id: str,
        dc: str = "com",
    ) -> None:
        if dc not in API_HOST:
            raise ValueError(f"Unknown Zoho data-center {dc!r}")
        self.client_id = client_id
        self.client_secret = client_secret
        self.refresh_token = refresh_token
        self.organization_id = organization_id
        self.accounts = ACCOUNTS_HOST[dc]
        self.api = f"{API_HOST[dc]}/invoice/v3"
        self._token: str | None = None
        self._token_expires_at: float = 0
        self._session = requests.Session()

    # ------------------------------------------------------------------ auth
    def _refresh_access_token(self) -> None:
        r = self._session.post(
            f"{self.accounts}/oauth/v2/token",
            params={
                "refresh_token": self.refresh_token,
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "grant_type": "refresh_token",
            },
            timeout=30,
        )
        r.raise_for_status()
        data = r.json()
        if "access_token" not in data:
            # Do NOT include the response body: it can echo the request.
            raise RuntimeError(
                f"Zoho token refresh failed (error={data.get('error', 'unknown')})"
            )
        self._token = data["access_token"]
        # Refresh a minute before it actually expires
        self._token_expires_at = time.time() + int(data.get("expires_in", 3600)) - 60

    def _auth_header(self) -> dict[str, str]:
        if not self._token or time.time() >= self._token_expires_at:
            self._refresh_access_token()
        return {"Authorization": f"Zoho-oauthtoken {self._token}"}

    # ------------------------------------------------------------------ http
    def _request(
        self,
        method: str,
        path: str,
        params: dict[str, Any] | None = None,
        max_retries: int = 5,
    ) -> dict[str, Any]:
        url = f"{self.api}{path}"
        params = {"organization_id": self.organization_id, **(params or {})}
        for attempt in range(max_retries):
            r = self._session.request(
                method,
                url,
                params=params,
                headers=self._auth_header(),
                timeout=60,
            )
            if r.status_code == 429 or r.status_code >= 500:
                delay = min(2**attempt, 30)
                log.warning("Zoho %s -> %s, retrying in %ss", path, r.status_code, delay)
                time.sleep(delay)
                continue
            if r.status_code == 401:
                self._token = None
                continue
            r.raise_for_status()
            return r.json()
        raise RuntimeError(f"Zoho {method} {path} failed after {max_retries} retries")

    # ------------------------------------------------------------------ paging
    def _paginate(self, path: str, list_key: str, params: dict[str, Any] | None = None) -> Iterator[dict]:
        page = 1
        while True:
            data = self._request("GET", path, {"page": page, "per_page": 200, **(params or {})})
            for row in data.get(list_key, []):
                yield row
            ctx = data.get("page_context") or {}
            if not ctx.get("has_more_page"):
                return
            page += 1

    # ------------------------------------------------------------- endpoints
    def list_contacts(self) -> Iterator[dict]:
        yield from self._paginate("/contacts", "contacts")

    def get_contact(self, contact_id: str) -> dict:
        return self._request("GET", f"/contacts/{contact_id}")["contact"]

    def list_items(self) -> Iterator[dict]:
        yield from self._paginate("/items", "items")

    def list_invoices(self, since: str | None = None) -> Iterator[dict]:
        params = {"date_start": since} if since else None
        yield from self._paginate("/invoices", "invoices", params)

    def get_invoice(self, invoice_id: str) -> dict:
        return self._request("GET", f"/invoices/{invoice_id}")["invoice"]

    def list_credit_notes(self, since: str | None = None) -> Iterator[dict]:
        params = {"date_start": since} if since else None
        yield from self._paginate("/creditnotes", "creditnotes", params)

    def get_credit_note(self, credit_note_id: str) -> dict:
        return self._request("GET", f"/creditnotes/{credit_note_id}")["creditnote"]

    def list_payments(self, since: str | None = None) -> Iterator[dict]:
        params = {"date_start": since} if since else None
        yield from self._paginate("/customerpayments", "customerpayments", params)

    def get_payment(self, payment_id: str) -> dict:
        return self._request("GET", f"/customerpayments/{payment_id}")["payment"]
