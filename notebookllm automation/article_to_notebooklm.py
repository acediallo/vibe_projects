#!/usr/bin/env python3
"""
article_to_notebooklm.py

Extract ALL articles from a Medium or Substack profile and automatically
add them as sources to a Google NotebookLM notebook.

Usage:
    python article_to_notebooklm.py https://swkhan.medium.com/
    python article_to_notebooklm.py https://username.substack.com/ --notebook "My Research"
    python article_to_notebooklm.py https://swkhan.medium.com/ --dry-run
    python article_to_notebooklm.py https://swkhan.medium.com/ --output urls.txt --dry-run

Requirements:
    pip install -r requirements.txt
    playwright install chromium
"""

import asyncio
import argparse
import re
import sys
import xml.etree.ElementTree as ET
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout

# NotebookLM source limits per notebook tier
MAX_SOURCES_PER_NOTEBOOK = 50  # Free tier; Plus=100, Pro=300


# ── Platform Detection ─────────────────────────────────────────────────────────

def detect_platform(url: str) -> str:
    host = urlparse(url).hostname or ""
    if "medium.com" in host:
        return "medium"
    if "substack.com" in host:
        return "substack"
    return "rss"


# ── Feed Parsing (stdlib — no feedparser needed) ───────────────────────────────

_ATOM_NS = "http://www.w3.org/2005/Atom"

def _parse_feed_urls(feed_url: str) -> list[str]:
    """Fetch an RSS 2.0 or Atom feed and return article URLs (no third-party parser)."""
    try:
        resp = requests.get(
            feed_url, timeout=15,
            headers={"User-Agent": "Mozilla/5.0"},
        )
        resp.raise_for_status()
        root = ET.fromstring(resp.content)
    except Exception as e:
        print(f"  Feed error ({feed_url}): {e}")
        return []

    urls: list[str] = []

    # RSS 2.0 — <item><link>...</link></item>
    for item in root.findall(".//item"):
        link = item.findtext("link")
        if link:
            urls.append(link.strip().split("?")[0])

    # Atom — <entry><link href="..." /></entry>
    if not urls:
        for entry in root.findall(f".//{{{_ATOM_NS}}}entry"):
            link_el = entry.find(f"{{{_ATOM_NS}}}link")
            if link_el is not None:
                href = link_el.get("href", "").strip()
                if href:
                    urls.append(href.split("?")[0])

    return urls


# ── Medium Extraction ──────────────────────────────────────────────────────────

def _medium_rss_url(profile_url: str) -> str:
    parsed = urlparse(profile_url)
    host = parsed.hostname or ""
    # e.g. swkhan.medium.com → https://swkhan.medium.com/feed
    if host.endswith(".medium.com") and host != "medium.com":
        return f"https://{host}/feed"
    # e.g. medium.com/@username
    path = parsed.path.strip("/")
    if path.startswith("@"):
        return f"https://medium.com/feed/{path}"
    return f"{profile_url.rstrip('/')}/feed"


def _is_medium_article(href: str, host: str) -> bool:
    """Return True if a URL looks like a Medium article link."""
    clean = href.split("?")[0].split("#")[0]
    # Standard Medium: /@author/some-title-a1b2c3d4
    if re.search(r"/@[\w.-]+/[\w-]+-[a-f0-9]{6,}$", clean):
        return True
    # Canonical short: /p/hexhash
    if re.search(r"/p/[a-f0-9]{8,}$", clean):
        return True
    # Custom subdomain article: swkhan.medium.com/some-title-a1b2c3d4
    if host and host in clean and re.search(r"/[\w-]+-[a-f0-9]{6,}$", clean):
        return True
    return False


async def scrape_medium_articles(profile_url: str) -> list[str]:
    """Get all articles from a Medium profile via RSS + Playwright scroll."""
    articles: set[str] = set()
    host = urlparse(profile_url).hostname or ""

    # 1. Quick grab from RSS (usually last 10)
    rss_url = _medium_rss_url(profile_url)
    for url in _parse_feed_urls(rss_url):
        articles.add(url)
    print(f"  RSS feed: {len(articles)} article(s) found")

    # 2. Playwright scroll for complete history
    print("  Scrolling profile page for full article history...")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            )
        )
        try:
            await page.goto(profile_url, wait_until="domcontentloaded", timeout=30_000)
        except Exception as e:
            print(f"  Warning: page load issue ({e}), continuing with partial data")

        no_change_streak = 0
        prev_count = len(articles)

        while no_change_streak < 4:
            try:
                hrefs = await page.eval_on_selector_all(
                    "a[href]", "els => els.map(e => e.href)"
                )
            except Exception:
                break

            for href in hrefs:
                if _is_medium_article(href, host):
                    articles.add(href.split("?")[0].split("#")[0])

            if len(articles) == prev_count:
                no_change_streak += 1
            else:
                no_change_streak = 0
                print(f"  Found {len(articles)} article(s) so far...")

            prev_count = len(articles)
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            await asyncio.sleep(2.5)

        await browser.close()

    return sorted(articles)


# ── Substack Extraction ────────────────────────────────────────────────────────

def scrape_substack_articles(profile_url: str) -> list[str]:
    """Get all Substack posts via undocumented API → RSS fallback."""
    base = profile_url.rstrip("/")
    articles: set[str] = set()

    # 1. Undocumented paginated API (most complete)
    print("  Trying Substack API...")
    page_num = 0
    while True:
        api_url = f"{base}/api/v1/posts?sort=new&limit=50&offset={page_num * 50}"
        try:
            resp = requests.get(api_url, timeout=15, headers={"User-Agent": "Mozilla/5.0"})
            if not resp.ok:
                break
            posts = resp.json()
            if not posts:
                break
            for post in posts:
                canon = post.get("canonical_url") or post.get("url")
                if canon:
                    articles.add(canon.split("?")[0])
            if len(posts) < 50:
                break
            page_num += 1
        except Exception as e:
            print(f"  Substack API error: {e}")
            break

    if articles:
        print(f"  Substack API: {len(articles)} post(s) found")
        return sorted(articles)

    # 2. RSS fallback
    print("  Falling back to RSS feed...")
    rss_url = f"{base}/feed"
    for url in _parse_feed_urls(rss_url):
        articles.add(url)
    print(f"  Substack RSS: {len(articles)} post(s) found")

    # 3. Sitemap fallback
    sitemap_url = f"{base}/sitemap.xml"
    try:
        resp = requests.get(sitemap_url, timeout=10)
        if resp.ok:
            soup = BeautifulSoup(resp.text, "lxml-xml")
            for loc in soup.find_all("loc"):
                url_text = loc.get_text()
                if "/p/" in url_text:
                    articles.add(url_text.split("?")[0])
            print(f"  After sitemap: {len(articles)} post(s) total")
    except Exception:
        pass

    return sorted(articles)


# ── Generic RSS Extraction ─────────────────────────────────────────────────────

def scrape_rss_articles(feed_url: str) -> list[str]:
    """Parse any RSS/Atom feed and return article URLs."""
    articles = _parse_feed_urls(feed_url)
    print(f"  RSS: {len(articles)} article(s) found")
    return sorted(articles)


# ── NotebookLM Automation ──────────────────────────────────────────────────────

async def list_notebooks(page) -> list[dict]:
    """
    Scrape the NotebookLM dashboard for existing notebooks.
    Returns a list of {"title": str, "url": str} dicts.
    """
    notebooks = []
    try:
        await page.wait_for_load_state("networkidle", timeout=15_000)
    except Exception:
        pass

    try:
        # Primary: notebook cards have anchor links containing /notebook/
        card_links = await page.eval_on_selector_all(
            'a[href*="/notebook/"]',
            """els => els.map(el => ({
                url: el.href,
                title: (el.querySelector('.notebook-title, .mat-mdc-card-title, h3, h2, [class*="title"]') || el).innerText.trim()
            }))"""
        )
        seen_urls = set()
        for item in card_links:
            url = item.get("url", "").strip()
            title = item.get("title", "").strip() or "(Untitled)"
            if url and url not in seen_urls:
                seen_urls.add(url)
                notebooks.append({"title": title, "url": url})
    except Exception:
        pass

    # Fallback: try data-notebook-id elements
    if not notebooks:
        try:
            cards = await page.eval_on_selector_all(
                '[data-notebook-id]',
                """els => els.map(el => ({
                    id: el.getAttribute('data-notebook-id'),
                    title: (el.querySelector('h3, h2, [class*="title"]') || el).innerText.trim()
                }))"""
            )
            for item in cards:
                nb_id = item.get("id", "").strip()
                title = item.get("title", "").strip() or "(Untitled)"
                if nb_id:
                    notebooks.append({
                        "title": title,
                        "url": f"https://notebooklm.google.com/notebook/{nb_id}"
                    })
        except Exception:
            pass

    return notebooks


def prompt_notebook_choice(notebooks: list[dict], article_count: int, default_name: str) -> dict:
    """
    Print a numbered list of existing notebooks and ask the user to pick one
    or create a new one.

    Returns one of:
      {"action": "existing", "notebook": {"title": ..., "url": ...}}
      {"action": "new",      "name": str}
      {"action": "manual"}   — user will navigate manually in the browser
    """
    print()
    if notebooks:
        print(f"Found {len(notebooks)} notebook(s) in your NotebookLM:")
        for i, nb in enumerate(notebooks, 1):
            print(f"  {i}. {nb['title']}")
    else:
        print("No existing notebooks found on the dashboard (UI may have changed).")
        print("  m. Navigate to the target notebook manually, then press Enter here")

    print("  0. Create a new notebook")
    print()

    max_choice = len(notebooks)
    while True:
        try:
            raw = input(f"Add {article_count} article(s) to which notebook? [0-{max_choice}]: ").strip()
        except (EOFError, KeyboardInterrupt):
            sys.exit(0)

        if raw.lower() == "m":
            return {"action": "manual"}

        try:
            choice = int(raw)
        except ValueError:
            print(f"  Please enter a number between 0 and {max_choice}.")
            continue

        if choice == 0:
            try:
                name = input(f"  Notebook name [{default_name}]: ").strip()
            except (EOFError, KeyboardInterrupt):
                sys.exit(0)
            return {"action": "new", "name": name or default_name}

        if 1 <= choice <= max_choice:
            return {"action": "existing", "notebook": notebooks[choice - 1]}

        print(f"  Please enter a number between 0 and {max_choice}.")


async def _add_url_source(page, url: str) -> bool:
    """
    Click through NotebookLM UI to add a single URL as a source.
    Returns True on success, False on failure.
    """
    try:
        # Click the "Add source" / "+ Add" button
        add_btn = page.locator(
            'button:has-text("Add source"), '
            'button:has-text("+ Add"), '
            '[aria-label="Add source"], '
            'button:has-text("Add")'
        ).first
        await add_btn.click(timeout=12_000)
        await asyncio.sleep(1)

        # Click "Website" in the source-type dialog
        # NotebookLM uses Material Design chips (mdc-evolution-chip)
        website_option = page.locator(
            'span.mdc-evolution-chip__text-label:has-text("Website"), '
            'button:has-text("Website"), '
            '[aria-label="Website"], '
            'div[role="option"]:has-text("Website"), '
            'span:has-text("Website")'
        ).first
        await website_option.click(timeout=12_000)
        await asyncio.sleep(0.8)

        # Fill in the URL field
        url_input = page.locator(
            'input[type="url"], '
            'input[placeholder*="URL" i], '
            'input[placeholder*="url" i], '
            'input[placeholder*="link" i], '
            'input[placeholder*="website" i]'
        ).first
        await url_input.fill(url, timeout=10_000)
        await asyncio.sleep(0.3)

        # Click Insert / Add / Submit
        insert_btn = page.locator(
            'button:has-text("Insert"), '
            'button:has-text("Add"), '
            'button[type="submit"]:not([disabled])'
        ).first
        await insert_btn.click(timeout=10_000)

        # Wait for the source to be processed (loading indicator disappears)
        await asyncio.sleep(4)
        return True

    except PlaywrightTimeout:
        print(f"    ⚠ Timed out adding source, skipping: {url}")
        # Try to dismiss any open dialog
        try:
            await page.keyboard.press("Escape")
        except Exception:
            pass
        return False
    except Exception as e:
        print(f"    ⚠ Error adding source ({e}), skipping: {url}")
        try:
            await page.keyboard.press("Escape")
        except Exception:
            pass
        return False


async def _create_new_notebook(page, name: str) -> bool:
    """Click 'New notebook' on the dashboard and wait for the notebook to open."""
    try:
        new_nb = page.locator(
            'button:has-text("New notebook"), '
            '[aria-label="New notebook"], '
            'button:has-text("Create notebook"), '
            'a:has-text("New notebook")'
        ).first
        await new_nb.click(timeout=15_000)
        await asyncio.sleep(2)
        await page.wait_for_load_state("networkidle", timeout=20_000)
        print(f'  Created new notebook (you can rename it "{name}" in NotebookLM).')
        return True
    except (PlaywrightTimeout, Exception) as e:
        print(f"  Could not create notebook: {e}")
        return False


async def add_to_notebooklm(article_urls: list[str], default_name: str, max_per_notebook: int):
    """
    Open NotebookLM, let the user choose an existing notebook or create a new
    one, then add all article URLs as sources into that notebook.

    If article_urls exceeds max_per_notebook the user is warned and overflow
    goes into additional notebooks named '<name> (2)', '<name> (3)', etc.
    """
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, slow_mo=200)
        context = await browser.new_context(viewport={"width": 1280, "height": 900})
        page = await context.new_page()

        print("\nOpening NotebookLM...")
        print("→ Log in with your Google account if prompted, then wait.")
        await page.goto("https://notebooklm.google.com")

        # Wait up to 2 minutes for login / dashboard to appear
        try:
            await page.wait_for_function(
                "() => window.location.hostname.includes('notebooklm')",
                timeout=120_000,
            )
            await page.wait_for_load_state("networkidle", timeout=30_000)
        except PlaywrightTimeout:
            print("Timed out waiting for login. Please re-run and log in promptly.")
            await browser.close()
            return

        print("✓ NotebookLM ready")

        # ── Scrape existing notebooks ────────────────────────────────────────
        notebooks = await list_notebooks(page)

        # ── Terminal prompt: pick notebook ───────────────────────────────────
        choice = prompt_notebook_choice(notebooks, len(article_urls), default_name)

        if choice["action"] == "existing":
            nb = choice["notebook"]
            print(f'\nNavigating to "{nb["title"]}"...')
            await page.goto(nb["url"])
            await page.wait_for_load_state("networkidle", timeout=20_000)
            await asyncio.sleep(1)
            nb_label = nb["title"]

        elif choice["action"] == "new":
            nb_label = choice["name"]
            print(f'\nCreating new notebook "{nb_label}"...')
            # Make sure we're on the dashboard first
            if "notebooklm.google.com" not in page.url or "/notebook/" in page.url:
                await page.goto("https://notebooklm.google.com")
                await page.wait_for_load_state("networkidle", timeout=20_000)
            ok = await _create_new_notebook(page, nb_label)
            if not ok:
                print("Aborting — could not open a notebook.")
                await browser.close()
                return

        else:  # manual
            print("\nPlease navigate to your target notebook in the browser.")
            print("Press Enter here when you are inside the notebook...")
            try:
                input()
            except (EOFError, KeyboardInterrupt):
                await browser.close()
                return
            nb_label = "selected notebook"

        # ── Overflow warning ─────────────────────────────────────────────────
        if len(article_urls) > max_per_notebook:
            overflow_count = len(article_urls) - max_per_notebook
            print(
                f"\n  Warning: {len(article_urls)} articles exceed the {max_per_notebook}-source "
                f"limit per notebook ({overflow_count} will spill into extra notebook(s))."
            )
            try:
                confirm = input("  Continue? [y/N]: ").strip().lower()
            except (EOFError, KeyboardInterrupt):
                await browser.close()
                return
            if confirm != "y":
                print("Aborted.")
                await browser.close()
                return

        # ── Split into chunks and add sources ────────────────────────────────
        chunks = [
            article_urls[i : i + max_per_notebook]
            for i in range(0, len(article_urls), max_per_notebook)
        ]

        for idx, chunk in enumerate(chunks):
            label = nb_label if idx == 0 else f"{nb_label} ({idx + 1})"

            if idx > 0:
                # Need a fresh notebook for overflow — go back to dashboard
                print(f'\nOverflow: creating notebook "{label}" for remaining {len(chunk)} article(s)...')
                await page.goto("https://notebooklm.google.com")
                await page.wait_for_load_state("networkidle", timeout=20_000)
                ok = await _create_new_notebook(page, label)
                if not ok:
                    print(f"  Skipping overflow chunk {idx + 1}.")
                    continue

            print(f'\nAdding {len(chunk)} article(s) to "{label}"...')
            added = 0
            for i, url in enumerate(chunk):
                print(f"  [{i + 1:>3}/{len(chunk)}] {url}")
                success = await _add_url_source(page, url)
                if success:
                    added += 1

            print(f'  ✓ Done — {added}/{len(chunk)} sources added to "{label}".')

        print("\nPress Enter to close the browser...")
        try:
            input()
        except EOFError:
            pass
        await browser.close()


# ── CLI ────────────────────────────────────────────────────────────────────────

async def main():
    parser = argparse.ArgumentParser(
        description=(
            "Extract articles from a Medium or Substack profile "
            "and add them to Google NotebookLM."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python article_to_notebooklm.py https://swkhan.medium.com/
  python article_to_notebooklm.py https://username.substack.com/
  python article_to_notebooklm.py https://swkhan.medium.com/ --dry-run
  python article_to_notebooklm.py https://swkhan.medium.com/ --output urls.txt
        """,
    )
    parser.add_argument("url", help="Medium or Substack profile URL")
    parser.add_argument(
        "--new-notebook-name", "-n",
        default=None,
        help=(
            "Default name suggested when creating a NEW notebook. "
            "Ignored if you choose an existing notebook at the prompt. "
            "(Defaults to the profile's hostname.)"
        ),
    )
    parser.add_argument(
        "--dry-run", "-d",
        action="store_true",
        help="List articles only; do not open NotebookLM",
    )
    parser.add_argument(
        "--output", "-o",
        help="Save discovered article URLs to a file (one per line)",
    )
    parser.add_argument(
        "--max-per-notebook",
        type=int,
        default=MAX_SOURCES_PER_NOTEBOOK,
        help=f"Max sources per notebook (default: {MAX_SOURCES_PER_NOTEBOOK}). "
             "Set higher if you have a paid NotebookLM plan.",
    )
    args = parser.parse_args()

    platform = detect_platform(args.url)
    print(f"Platform : {platform}")
    print(f"Profile  : {args.url}")
    print()

    # ── Extract ──────────────────────────────────────────────────────────────
    if platform == "medium":
        articles = await scrape_medium_articles(args.url)
    elif platform == "substack":
        articles = scrape_substack_articles(args.url)
    else:
        print("Unknown platform — treating URL as an RSS/Atom feed.")
        articles = scrape_rss_articles(args.url)

    print(f"\nTotal articles found: {len(articles)}")

    if not articles:
        print("No articles found. Check the URL and try again.")
        sys.exit(1)

    # ── Save to file ──────────────────────────────────────────────────────────
    if args.output:
        with open(args.output, "w") as f:
            f.write("\n".join(articles) + "\n")
        print(f"URLs saved to: {args.output}")

    # ── Dry run ───────────────────────────────────────────────────────────────
    if args.dry_run:
        print("\nArticles found (dry run — NotebookLM not opened):")
        for i, url in enumerate(articles, 1):
            print(f"  {i:>4}. {url}")
        return

    # ── Default notebook name = profile hostname ──────────────────────────────
    default_name = args.new_notebook_name or (urlparse(args.url).hostname or "Articles")

    # ── NotebookLM ────────────────────────────────────────────────────────────
    await add_to_notebooklm(articles, default_name, args.max_per_notebook)


if __name__ == "__main__":
    asyncio.run(main())
