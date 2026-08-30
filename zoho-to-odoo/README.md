# Zoho Invoice → Odoo

One-shot migration script (and small Streamlit UI) that moves your Zoho
Invoice data into an Odoo database.

## What gets moved

| Zoho Invoice     | Odoo model         | Notes                                              |
|------------------|--------------------|----------------------------------------------------|
| Contacts         | `res.partner`      | Billing/shipping addresses become child partners.  |
| Items            | `product.product`  | Service items become services, everything else consumables. |
| Invoices         | `account.move` (`out_invoice`)   | Posted if the Zoho status is anything past draft.   |
| Credit notes     | `account.move` (`out_refund`)    | Same posting rule.                                  |
| Customer payments| `account.payment`  | Uses the first bank journal it finds.               |

Each transferred record is stored in `state.json` (Zoho id → Odoo id), so
re-running the migration updates existing records instead of duplicating.

## Setup

```bash
cd zoho-to-odoo
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env      # fill in Zoho + Odoo credentials
```

Zoho refresh token: create a **Self Client** at
<https://api-console.zoho.com/>, request the scope
`ZohoInvoice.fullaccess.all`, then exchange the one-time code for a refresh
token. Grab your `organization_id` from Settings → Organizations in Zoho
Invoice.

Odoo API key: in Odoo → user preferences → Account Security → New API Key.

## Run — CLI

```bash
python main.py                       # everything, in dependency order
python main.py --only contacts,items # a subset
python main.py --since 2024-01-01    # only recent documents
python main.py --dry-run             # fetch + log, no writes to Odoo
```

## Run — Streamlit UI

```bash
streamlit run streamlit_app.py
```

The UI reads `.env` for defaults, lets you tick the resources to migrate,
toggles dry-run, and streams the log while it runs.

## Layout

```
zoho_client.py    Zoho REST wrapper (OAuth, pagination, retries)
odoo_client.py    Odoo XML-RPC wrapper
state.py          JSON-backed Zoho -> Odoo id map
transfer.py       Per-resource migration logic
main.py           CLI
streamlit_app.py  UI
```

## Caveats

- Taxes: line items carry `price_unit` but no tax mapping (Odoo tax setups
  vary too much to guess). Configure fiscal positions in Odoo and let it
  re-apply taxes when documents are posted, or add a mapping in
  `transfer.py::_migrate_moves` for your specific tax names.
- Bank journals: the payment migrator picks the first `type=bank` journal.
  If you have multiple, edit `_migrate_one_payment` to route by
  `payment_mode`.
- Attachments and Zoho custom fields are not copied — add another pass in
  `transfer.py` if you need them.
- Run against a **staging Odoo database first**; the id-map file lets you
  wipe it and re-run cleanly.
