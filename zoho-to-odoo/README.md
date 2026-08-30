# Zoho Invoice → Odoo

One-shot migration script (with an optional Streamlit UI) that copies your
Zoho Invoice data into an Odoo database.

## What gets moved

| Zoho Invoice      | Odoo model                       | Notes                                              |
|-------------------|----------------------------------|----------------------------------------------------|
| Contacts          | `res.partner`                    | Billing/shipping addresses become child partners.  |
| Items             | `product.product`                | Service items → services, everything else consumables. |
| Invoices          | `account.move` (`out_invoice`)   | Posted if the Zoho status is anything past draft.  |
| Credit notes      | `account.move` (`out_refund`)    | Same posting rule.                                 |
| Customer payments | `account.payment`                | Uses the first bank journal it finds.              |

Each transferred record is stored in `state.json` (Zoho id → Odoo id), so
re-running the migration updates existing records instead of duplicating.

---

## 1. Set up your Zoho Invoice access

You need four values from Zoho:

1. **Client ID** and **Client secret** — from a Self Client in the Zoho API
   Console.
2. **Refresh token** — long-lived credential the script uses to mint access
   tokens.
3. **Organization ID** — the Zoho org whose data you want to migrate.

### 1a. Create a Self Client

1. Open <https://api-console.zoho.com/> (log in with the same account that
   owns the Zoho Invoice data).
2. **Add Client → Self Client → Create.**
3. Note the **Client ID** and **Client Secret** on the *Client Secret* tab.

### 1b. Generate the refresh token

1. In the Self Client, open the **Generate Code** tab.
2. Scope: `ZohoInvoice.fullaccess.all`.
3. Time duration: 10 minutes. Scope description: anything.
4. Click **Create** — Zoho gives you a one-time `code=…`. Copy it.
5. Exchange it for a refresh token (within 10 minutes). From a terminal:

   ```bash
   curl -X POST "https://accounts.zoho.com/oauth/v2/token" \
     -d "grant_type=authorization_code" \
     -d "client_id=YOUR_CLIENT_ID" \
     -d "client_secret=YOUR_CLIENT_SECRET" \
     -d "code=THE_ONE_TIME_CODE"
   ```

   Replace `accounts.zoho.com` with your data-center host if you're on `eu`,
   `in`, `com.au`, `jp`, `ca` or `sa`. The response contains a
   `refresh_token` — copy that.

### 1c. Find your Organization ID

Zoho Invoice → **Settings (gear) → Organizations**. Copy the numeric ID
next to the org you want to migrate.

### 1d. Note your data-center code

Look at the URL you use for Zoho Invoice:

| URL host              | `ZOHO_DC` value |
|-----------------------|-----------------|
| `.com`                | `com`           |
| `.eu`                 | `eu`            |
| `.in`                 | `in`            |
| `.com.au`             | `com.au`        |
| `.jp`                 | `jp`            |
| `.ca` / `.zohocloud.ca` | `ca`          |
| `.sa`                 | `sa`            |

---

## 2. Set up your Odoo access

The script talks to Odoo over XML-RPC (works on `odoo.com` online, on-prem,
and self-hosted). You need:

1. **URL** — e.g. `https://mycompany.odoo.com`.
2. **Database name** — for `odoo.com` it's the subdomain (`mycompany`); for
   self-hosted see `Settings → Databases` or your admin.
3. **Username** — the login (email).
4. **API key** — never use the password. Odoo → click your avatar →
   **Preferences → Account Security → New API Key**. Copy it once (Odoo
   won't show it again).

**Strongly recommended: run against a fresh staging database first.** On
odoo.com you can duplicate a database from `mycompany.odoo.com/web/database/manager`.
The migration is idempotent, but the first pass is when you find the
edge cases in your data.

---

## 3. Install locally

```bash
git clone https://github.com/acediallo/vibe_projects.git
cd vibe_projects/zoho-to-odoo
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Open `.env` and paste the values from steps 1 and 2. Keep the file local
— it's gitignored (see the Security section below).

---

## 4. How to use

Both entry points read the same `.env` and use the same migration logic,
so pick whichever fits.

### 4a. CLI

```bash
# Everything, in dependency order (contacts → items → invoices → …)
python main.py

# Dry-run: fetch from Zoho, log what would happen, write nothing
python main.py --dry-run

# A single resource, or a subset
python main.py --only contacts
python main.py --only contacts,items

# Only documents on or after a date (invoices / credit notes / payments)
python main.py --since 2024-01-01

# Verbose logging
python main.py -v
```

Recommended first-run sequence:

```bash
# 1. Verify credentials + fetch works without writing anything
python main.py --dry-run

# 2. Move the reference data first
python main.py --only contacts,items

# 3. Then the documents (all of them, or since a cut-over date)
python main.py --only invoices,credit_notes,payments --since 2024-01-01
```

At the end you get a summary like:

```
Summary:
  contacts       {'created': 214, 'updated': 0, 'skipped': 0, 'failed': 0}
  items          {'created': 87,  'updated': 0, 'skipped': 0, 'failed': 0}
  invoices       {'created': 921, 'updated': 0, 'skipped': 0, 'failed': 2}
```

Failures are logged with the Zoho id — re-run once you've fixed the cause;
already-transferred records are skipped automatically.

### 4b. Streamlit UI

```bash
streamlit run streamlit_app.py
```

Opens on <http://localhost:8501>. The sidebar is pre-filled from `.env`;
edit values there if you want to override for a single session (they stay
in the browser tab and are never written back to disk). Pick the
resources you want in the main pane, tick **Dry run** for the first pass,
click **Run migration**, and watch the log stream live. A summary table
prints when it finishes.

### 4c. Re-running and rollback

- Re-runs are safe. Contacts and items are updated in place; invoices,
  credit notes and payments are skipped once transferred (Zoho id is in
  `state.json`).
- To start over: delete `state.json` (and clear the Odoo records you no
  longer want — a duplicated staging DB is easiest).
- Migrating a delta after a cut-over: use `--since YYYY-MM-DD` — the map
  file will keep existing records untouched and only new ones will
  transfer.

---

## 5. Security notes

- **`.env` and `state.json` are gitignored.** So are `.env.*`, `*.env`,
  `secrets.*`, `credentials.*` and Streamlit's `.streamlit/secrets.toml`.
  Before your first commit, run `git status` and confirm none of those
  appear.
- **Secrets are never printed.** Token-refresh failures log the Zoho
  error code but not the response body (which can echo the request). No
  credential is written to logs or `state.json`.
- **The Streamlit UI masks secrets** (`type="password"` for client
  secret, refresh token and Odoo API key). Session values stay in the
  browser tab and are never persisted server-side by this app.
- **Use an Odoo API key, not the account password** — it can be revoked
  from Odoo → Preferences → Account Security without changing the login.
- **Rotate the Zoho refresh token** after the migration completes: delete
  the Self Client in the Zoho API Console (or generate a new refresh
  token and discard the old one).
- If you accidentally commit an `.env`, treat those credentials as
  burned: rotate both the Odoo API key and the Zoho refresh token *and*
  purge the file from history (`git filter-repo` or GitHub support).

---

## 6. Caveats

- **Taxes** — line items carry `price_unit` but no tax mapping (Odoo tax
  configurations vary too much to guess). Configure fiscal positions in
  Odoo and let it re-apply taxes on post, or add a tax-name mapping in
  `transfer.py::_create_move` for your specific rates.
- **Bank journal** — the payment migrator picks the first `type=bank`
  journal it finds. Edit `_migrate_one_payment` if you need to route by
  `payment_mode`.
- **Attachments and Zoho custom fields** are not copied — add a pass in
  `transfer.py` if you need them.
- **Estimates / recurring invoices** are not covered by default; the
  Zoho endpoints exist, extend `zoho_client.py` + `transfer.py` if you
  need them.

---

## Layout

```
zoho_client.py     Zoho REST wrapper (OAuth, pagination, retries)
odoo_client.py     Odoo XML-RPC wrapper
state.py           JSON-backed Zoho -> Odoo id map (idempotency)
transfer.py        Per-resource migration logic
main.py            CLI entry point
streamlit_app.py   UI wrapper
.env.example       Fill in and rename to .env
```
