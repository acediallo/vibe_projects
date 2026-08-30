"""Per-resource migration logic: Zoho record -> Odoo record."""
from __future__ import annotations

import logging
from dataclasses import dataclass

from odoo_client import OdooClient
from state import Mapping
from zoho_client import ZohoInvoiceClient

log = logging.getLogger(__name__)


@dataclass
class Counts:
    created: int = 0
    updated: int = 0
    skipped: int = 0
    failed: int = 0

    def as_dict(self) -> dict[str, int]:
        return {"created": self.created, "updated": self.updated, "skipped": self.skipped, "failed": self.failed}


class Migrator:
    """Coordinates transfers and holds shared state (id map, dry-run flag)."""

    def __init__(
        self,
        zoho: ZohoInvoiceClient,
        odoo: OdooClient,
        mapping: Mapping,
        dry_run: bool = False,
        since: str | None = None,
    ) -> None:
        self.zoho = zoho
        self.odoo = odoo
        self.map = mapping
        self.dry_run = dry_run
        self.since = since or None

    # =========================================================== contacts ==
    def migrate_contacts(self) -> Counts:
        c = Counts()
        for row in self.zoho.list_contacts():
            try:
                self._migrate_one_contact(row, c)
            except Exception:
                log.exception("Failed contact %s", row.get("contact_id"))
                c.failed += 1
        return c

    def _migrate_one_contact(self, row: dict, c: Counts) -> None:
        zid = row["contact_id"]
        odoo_id = self.map.get("contact", zid)
        # Fetch full detail (list view omits address/currency).
        full = self.zoho.get_contact(zid)
        values = self._contact_values(full)
        if odoo_id:
            if not self.dry_run:
                self.odoo.write("res.partner", [odoo_id], values)
            c.updated += 1
            return
        if self.dry_run:
            log.info("[dry-run] would create partner %s", values.get("name"))
            c.created += 1
            return
        new_id = self.odoo.create("res.partner", values)
        self.map.set("contact", zid, new_id)
        c.created += 1
        # Attach billing/shipping addresses as child partners.
        for addr_type, addr in (("invoice", full.get("billing_address")), ("delivery", full.get("shipping_address"))):
            if addr and (addr.get("address") or addr.get("city")):
                addr_values = self._address_values(addr, addr_type, new_id, full)
                self.odoo.create("res.partner", addr_values)

    def _contact_values(self, contact: dict) -> dict:
        primary = (contact.get("contact_persons") or [{}])[0]
        billing = contact.get("billing_address") or {}
        name = contact.get("contact_name") or contact.get("company_name") or (
            f"{primary.get('first_name', '')} {primary.get('last_name', '')}".strip()
        )
        values: dict = {
            "name": name or f"Zoho contact {contact['contact_id']}",
            "company_type": "company" if contact.get("contact_type") == "customer" and contact.get("company_name") else "person",
            "email": contact.get("email") or primary.get("email") or False,
            "phone": contact.get("phone") or primary.get("phone") or False,
            "mobile": contact.get("mobile") or primary.get("mobile") or False,
            "website": contact.get("website") or False,
            "vat": contact.get("cf_vat") or contact.get("tax_reg_no") or False,
            "customer_rank": 1 if contact.get("contact_type") in (None, "customer", "customer_and_vendor") else 0,
            "supplier_rank": 1 if contact.get("contact_type") in ("vendor", "customer_and_vendor") else 0,
            "comment": contact.get("notes") or False,
            "ref": f"zoho:{contact['contact_id']}",
        }
        if billing:
            values.update(
                street=billing.get("address") or False,
                street2=billing.get("street2") or False,
                city=billing.get("city") or False,
                zip=billing.get("zip") or False,
            )
            country_code = billing.get("country_code") or _country_name_to_code(billing.get("country"))
            country = self.odoo.country_id(country_code)
            if country:
                values["country_id"] = country
        currency = self.odoo.currency_id(contact.get("currency_code"))
        if currency:
            values["property_purchase_currency_id"] = currency
        return values

    def _address_values(self, addr: dict, addr_type: str, parent_id: int, contact: dict) -> dict:
        return {
            "parent_id": parent_id,
            "type": addr_type,
            "name": addr.get("attention") or contact.get("contact_name") or "Address",
            "street": addr.get("address") or False,
            "street2": addr.get("street2") or False,
            "city": addr.get("city") or False,
            "zip": addr.get("zip") or False,
            "phone": addr.get("phone") or False,
            "country_id": self.odoo.country_id(addr.get("country_code")) or False,
        }

    # ============================================================= items ===
    def migrate_items(self) -> Counts:
        c = Counts()
        for item in self.zoho.list_items():
            try:
                self._migrate_one_item(item, c)
            except Exception:
                log.exception("Failed item %s", item.get("item_id"))
                c.failed += 1
        return c

    def _migrate_one_item(self, item: dict, c: Counts) -> None:
        zid = item["item_id"]
        odoo_id = self.map.get("item", zid)
        values = {
            "name": item.get("name") or "Zoho item",
            "default_code": item.get("sku") or False,
            "list_price": float(item.get("rate") or 0.0),
            "description_sale": item.get("description") or False,
            "type": "service" if item.get("product_type", "goods") == "service" else "consu",
            "sale_ok": bool(item.get("status", "active") == "active"),
            "uom_id": self.odoo.uom_id(item.get("unit")),
            "uom_po_id": self.odoo.uom_id(item.get("unit")),
        }
        if odoo_id:
            if not self.dry_run:
                self.odoo.write("product.product", [odoo_id], values)
            c.updated += 1
            return
        if self.dry_run:
            log.info("[dry-run] would create product %s", values["name"])
            c.created += 1
            return
        new_id = self.odoo.create("product.product", values)
        self.map.set("item", zid, new_id)
        c.created += 1

    # ========================================================== invoices ==
    def migrate_invoices(self) -> Counts:
        return self._migrate_moves(
            list_iter=self.zoho.list_invoices(self.since),
            get_full=self.zoho.get_invoice,
            id_key="invoice_id",
            number_key="invoice_number",
            date_key="date",
            due_key="due_date",
            move_type="out_invoice",
            state_key="status",
            kind="invoice",
        )

    # ====================================================== credit_notes ==
    def migrate_credit_notes(self) -> Counts:
        return self._migrate_moves(
            list_iter=self.zoho.list_credit_notes(self.since),
            get_full=self.zoho.get_credit_note,
            id_key="creditnote_id",
            number_key="creditnote_number",
            date_key="date",
            due_key=None,
            move_type="out_refund",
            state_key="status",
            kind="credit_note",
        )

    def _migrate_moves(
        self,
        list_iter,
        get_full,
        id_key: str,
        number_key: str,
        date_key: str,
        due_key: str | None,
        move_type: str,
        state_key: str,
        kind: str,
    ) -> Counts:
        c = Counts()
        for stub in list_iter:
            zid = stub[id_key]
            if self.map.get(kind, zid):
                c.skipped += 1
                continue
            try:
                doc = get_full(zid)
                self._create_move(doc, id_key, number_key, date_key, due_key, move_type, state_key, kind, c)
            except Exception:
                log.exception("Failed %s %s", kind, zid)
                c.failed += 1
        return c

    def _create_move(
        self,
        doc: dict,
        id_key: str,
        number_key: str,
        date_key: str,
        due_key: str | None,
        move_type: str,
        state_key: str,
        kind: str,
        c: Counts,
    ) -> None:
        zid = doc[id_key]
        partner_id = self._resolve_partner(doc)
        if not partner_id:
            log.warning("%s %s has no matching partner - skipped", kind, zid)
            c.skipped += 1
            return
        lines = []
        for line in doc.get("line_items", []):
            product_id = self.map.get("item", line.get("item_id") or "") if line.get("item_id") else None
            lines.append((0, 0, {
                "product_id": product_id or False,
                "name": line.get("name") or line.get("description") or "Line",
                "quantity": float(line.get("quantity") or 1.0),
                "price_unit": float(line.get("rate") or 0.0),
            }))
        values: dict = {
            "move_type": move_type,
            "partner_id": partner_id,
            "invoice_date": doc.get(date_key),
            "ref": f"zoho:{doc.get(number_key) or zid}",
            "narration": doc.get("notes") or False,
            "invoice_line_ids": lines,
        }
        if due_key and doc.get(due_key):
            values["invoice_date_due"] = doc[due_key]
        currency = self.odoo.currency_id(doc.get("currency_code"))
        if currency:
            values["currency_id"] = currency
        if self.dry_run:
            log.info("[dry-run] would create %s %s (%s lines)", kind, values["ref"], len(lines))
            c.created += 1
            return
        new_id = self.odoo.create("account.move", values)
        self.map.set(kind, zid, new_id)
        # Post if Zoho already considered it issued.
        if doc.get(state_key) in {"sent", "viewed", "overdue", "paid", "partially_paid", "open", "closed"}:
            try:
                self.odoo.execute("account.move", "action_post", [[new_id]])
            except Exception:
                log.exception("Could not post %s id=%s", kind, new_id)
        c.created += 1

    def _resolve_partner(self, doc: dict) -> int | None:
        contact_id = doc.get("customer_id") or doc.get("contact_id")
        if contact_id:
            odoo_id = self.map.get("contact", contact_id)
            if odoo_id:
                return odoo_id
        # Fall back to a name match.
        name = doc.get("customer_name") or doc.get("contact_name")
        if not name:
            return None
        row = self.odoo.find_one("res.partner", [("name", "=", name)])
        return row["id"] if row else None

    # =========================================================== payments =
    def migrate_payments(self) -> Counts:
        c = Counts()
        for stub in self.zoho.list_payments(self.since):
            zid = stub["payment_id"]
            if self.map.get("payment", zid):
                c.skipped += 1
                continue
            try:
                self._migrate_one_payment(self.zoho.get_payment(zid), c)
            except Exception:
                log.exception("Failed payment %s", zid)
                c.failed += 1
        return c

    def _migrate_one_payment(self, payment: dict, c: Counts) -> None:
        partner_id = self._resolve_partner(payment)
        if not partner_id:
            c.skipped += 1
            return
        journal = self.odoo.find_one("account.journal", [("type", "=", "bank")])
        if not journal:
            log.warning("No bank journal in Odoo - cannot create payment %s", payment.get("payment_id"))
            c.skipped += 1
            return
        values = {
            "partner_id": partner_id,
            "partner_type": "customer",
            "payment_type": "inbound",
            "amount": float(payment.get("amount") or 0.0),
            "date": payment.get("date"),
            "journal_id": journal["id"],
            "ref": f"zoho:{payment.get('payment_number') or payment['payment_id']}",
        }
        currency = self.odoo.currency_id(payment.get("currency_code"))
        if currency:
            values["currency_id"] = currency
        if self.dry_run:
            log.info("[dry-run] would create payment %s (%.2f)", values["ref"], values["amount"])
            c.created += 1
            return
        new_id = self.odoo.create("account.payment", values)
        self.map.set("payment", payment["payment_id"], new_id)
        try:
            self.odoo.execute("account.payment", "action_post", [[new_id]])
        except Exception:
            log.exception("Could not post payment id=%s", new_id)
        c.created += 1


# --- tiny helpers ---------------------------------------------------------
_COUNTRY_NAME_TO_CODE = {
    "united states": "US", "usa": "US", "u.s.a.": "US",
    "united kingdom": "GB", "uk": "GB", "great britain": "GB",
    "france": "FR", "germany": "DE", "spain": "ES", "italy": "IT",
    "senegal": "SN", "canada": "CA", "australia": "AU",
    "india": "IN", "netherlands": "NL", "belgium": "BE",
}


def _country_name_to_code(name: str | None) -> str | None:
    if not name:
        return None
    return _COUNTRY_NAME_TO_CODE.get(name.strip().lower())
