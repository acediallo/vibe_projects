"""CLI entry point: run the Zoho Invoice -> Odoo migration."""
from __future__ import annotations

import argparse
import logging
import os
import sys

from dotenv import load_dotenv

from odoo_client import OdooClient
from state import Mapping
from transfer import Counts, Migrator
from zoho_client import ZohoInvoiceClient

ALL_RESOURCES = ["contacts", "items", "invoices", "credit_notes", "payments"]


def build_migrator(dry_run: bool, since: str | None) -> Migrator:
    load_dotenv()
    zoho = ZohoInvoiceClient(
        client_id=_require("ZOHO_CLIENT_ID"),
        client_secret=_require("ZOHO_CLIENT_SECRET"),
        refresh_token=_require("ZOHO_REFRESH_TOKEN"),
        organization_id=_require("ZOHO_ORGANIZATION_ID"),
        dc=os.getenv("ZOHO_DC", "com"),
    )
    odoo = OdooClient(
        url=_require("ODOO_URL"),
        db=_require("ODOO_DB"),
        username=_require("ODOO_USERNAME"),
        api_key=_require("ODOO_API_KEY"),
    )
    return Migrator(zoho, odoo, Mapping(), dry_run=dry_run, since=since)


def _require(key: str) -> str:
    value = os.getenv(key)
    if not value:
        raise SystemExit(f"Missing required environment variable {key}")
    return value


def run(resources: list[str], dry_run: bool, since: str | None) -> dict[str, Counts]:
    migrator = build_migrator(dry_run, since)
    results: dict[str, Counts] = {}
    for name in resources:
        handler = getattr(migrator, f"migrate_{name}", None)
        if handler is None:
            logging.warning("Unknown resource %r, skipping", name)
            continue
        logging.info("=== %s ===", name)
        results[name] = handler()
        logging.info("%s: %s", name, results[name].as_dict())
    return results


def main(argv: list[str] | None = None) -> int:
    load_dotenv()
    parser = argparse.ArgumentParser(description="Migrate Zoho Invoice data into Odoo")
    parser.add_argument(
        "--only",
        help="Comma-separated resources (default: env MIGRATE or all)",
        default=os.getenv("MIGRATE") or ",".join(ALL_RESOURCES),
    )
    parser.add_argument("--since", default=os.getenv("MIGRATE_SINCE") or None,
                        help="Only migrate documents on/after this ISO date (YYYY-MM-DD)")
    parser.add_argument("--dry-run", action="store_true",
                        default=os.getenv("DRY_RUN") == "1",
                        help="Fetch and log but do not write to Odoo")
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    resources = [r.strip() for r in args.only.split(",") if r.strip()]
    results = run(resources, dry_run=args.dry_run, since=args.since)

    print("\nSummary:")
    for name, counts in results.items():
        print(f"  {name:14s} {counts.as_dict()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
