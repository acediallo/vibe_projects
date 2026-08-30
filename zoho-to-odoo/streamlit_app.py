"""Streamlit wrapper around the Zoho -> Odoo migration.

Run with:  streamlit run streamlit_app.py
"""
from __future__ import annotations

import logging
import os
from io import StringIO

import streamlit as st
from dotenv import load_dotenv

from main import ALL_RESOURCES, build_migrator

load_dotenv()

st.set_page_config(page_title="Zoho Invoice -> Odoo", page_icon=":arrow_right:", layout="wide")
st.title("Zoho Invoice → Odoo migration")
st.caption(
    "Pick which resources to move, review the settings loaded from `.env`, "
    "and run. Re-runs are safe: already-transferred records are updated in "
    "place rather than duplicated."
)

# --- credentials -----------------------------------------------------------
with st.sidebar:
    st.header("Zoho")
    st.text_input("Client ID", key="ZOHO_CLIENT_ID", value=os.getenv("ZOHO_CLIENT_ID", ""))
    st.text_input("Client secret", key="ZOHO_CLIENT_SECRET", type="password",
                  value=os.getenv("ZOHO_CLIENT_SECRET", ""))
    st.text_input("Refresh token", key="ZOHO_REFRESH_TOKEN", type="password",
                  value=os.getenv("ZOHO_REFRESH_TOKEN", ""))
    st.text_input("Organization ID", key="ZOHO_ORGANIZATION_ID",
                  value=os.getenv("ZOHO_ORGANIZATION_ID", ""))
    st.selectbox("Data center", ["com", "eu", "in", "com.au", "jp", "ca", "sa"],
                 key="ZOHO_DC",
                 index=["com", "eu", "in", "com.au", "jp", "ca", "sa"].index(
                     os.getenv("ZOHO_DC", "com")))

    st.header("Odoo")
    st.text_input("URL", key="ODOO_URL", value=os.getenv("ODOO_URL", ""))
    st.text_input("Database", key="ODOO_DB", value=os.getenv("ODOO_DB", ""))
    st.text_input("Username", key="ODOO_USERNAME", value=os.getenv("ODOO_USERNAME", ""))
    st.text_input("API key", key="ODOO_API_KEY", type="password",
                  value=os.getenv("ODOO_API_KEY", ""))

col1, col2 = st.columns([2, 1])
with col1:
    resources = st.multiselect(
        "Resources to migrate (order matters - contacts first, then items, then documents)",
        options=ALL_RESOURCES,
        default=[r for r in ALL_RESOURCES if r in (os.getenv("MIGRATE") or ",".join(ALL_RESOURCES)).split(",")],
    )
    since = st.text_input("Only documents on/after (YYYY-MM-DD, optional)",
                         value=os.getenv("MIGRATE_SINCE", ""))
with col2:
    dry_run = st.toggle("Dry run", value=os.getenv("DRY_RUN") == "1",
                        help="Fetch from Zoho and log actions, but write nothing to Odoo.")
    run_button = st.button("Run migration", type="primary", use_container_width=True,
                           disabled=not resources)

log_area = st.empty()
summary_area = st.container()


class _StreamlitLogHandler(logging.Handler):
    def __init__(self, buffer: StringIO, placeholder) -> None:
        super().__init__()
        self.buffer = buffer
        self.placeholder = placeholder

    def emit(self, record: logging.LogRecord) -> None:
        self.buffer.write(self.format(record) + "\n")
        self.placeholder.code(self.buffer.getvalue(), language="text")


def _apply_settings_to_env() -> None:
    for k in (
        "ZOHO_CLIENT_ID", "ZOHO_CLIENT_SECRET", "ZOHO_REFRESH_TOKEN",
        "ZOHO_ORGANIZATION_ID", "ZOHO_DC",
        "ODOO_URL", "ODOO_DB", "ODOO_USERNAME", "ODOO_API_KEY",
    ):
        val = st.session_state.get(k)
        if val:
            os.environ[k] = val


if run_button:
    _apply_settings_to_env()
    buffer = StringIO()
    handler = _StreamlitLogHandler(buffer, log_area)
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    root.addHandler(handler)
    try:
        with st.spinner("Migrating..."):
            migrator = build_migrator(dry_run=dry_run, since=since or None)
            results = {}
            for name in resources:
                fn = getattr(migrator, f"migrate_{name}")
                logging.info("=== %s ===", name)
                results[name] = fn()
                logging.info("%s: %s", name, results[name].as_dict())
        summary_area.success("Done." if not dry_run else "Dry-run complete.")
        summary_area.table({name: c.as_dict() for name, c in results.items()})
    except Exception as exc:
        logging.exception("Migration failed")
        summary_area.error(f"Migration failed: {exc}")
    finally:
        root.removeHandler(handler)
