#!/usr/bin/env python3
"""
Entry-level job scraper for Nigerian (and configurable) job boards.

Sites covered out of the box:
  - Jobberman       (jobberman.com)
  - MyJobMag        (myjobmag.com)
  - HotNigerianJobs (hotnigerianjobs.com)
  - NgCareers       (ngcareers.com)
  - Jobgurus        (jobgurus.com.ng)
  - Indeed          (ng.indeed.com, configurable per country)

Outputs a CSV with: site, title, company, location, remote_type, industry,
years_experience, skills, salary, posting_date, deadline, days_until_deadline,
description, url, scraped_at.

Usage:
  python job_scraper.py                       # interactive prompts
  python job_scraper.py --country Nigeria --keyword "data analyst" --pages 2
  python job_scraper.py --sites jobberman,myjobmag --no-browser --output jobs.csv

Notes:
  - HTML scraping breaks when sites change layout. Adapters are isolated so
    a failure in one site does not abort the run.
  - Default stack is requests + BeautifulSoup. Playwright is used as a
    fallback when a page looks JS-rendered or returns a bot wall. Install
    once with: pip install -r requirements.txt && playwright install chromium
  - Respect each site's terms of service and robots.txt. Rate-limited by
    default (~1.5s between requests).
"""

from __future__ import annotations

import argparse
import csv
import logging
import os
import random
import re
import sys
import time
from dataclasses import dataclass, asdict, field
from datetime import datetime, date
from typing import Iterable, Iterator, Optional
from urllib.parse import quote_plus, urljoin

import requests
from bs4 import BeautifulSoup
from dateutil import parser as date_parser

log = logging.getLogger("job_scraper")

USER_AGENTS = [
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
]

REQUEST_DELAY_SECONDS = 1.5
REQUEST_TIMEOUT = 25

ENTRY_LEVEL_HINTS = (
    "entry", "entry-level", "entry level", "graduate", "junior",
    "trainee", "intern", "no experience", "fresh", "0-1", "0-2", "1-2",
)

# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------


@dataclass
class Job:
    site: str
    title: str
    company: str = ""
    location: str = ""
    remote_type: str = ""        # remote / hybrid / onsite / unknown
    industry: str = ""
    years_experience: str = ""   # normalized: "0-2", "1+", "entry", "unknown"
    skills: str = ""             # semicolon-joined
    salary: str = ""
    posting_date: str = ""       # ISO YYYY-MM-DD when parsable
    deadline: str = ""           # ISO YYYY-MM-DD when parsable
    days_until_deadline: str = ""
    description: str = ""
    url: str = ""
    scraped_at: str = field(default_factory=lambda: datetime.utcnow().isoformat(timespec="seconds"))


# ---------------------------------------------------------------------------
# Keyword catalogs (extend freely)
# ---------------------------------------------------------------------------

SKILL_KEYWORDS = sorted({
    # Tech
    "python", "java", "javascript", "typescript", "c#", "c++", "go", "rust",
    "php", "ruby", "kotlin", "swift", "sql", "nosql", "mongodb", "postgresql",
    "mysql", "redis", "react", "angular", "vue", "next.js", "node.js", "django",
    "flask", "fastapi", "spring", "laravel", "express",
    "html", "css", "tailwind", "bootstrap",
    "aws", "azure", "gcp", "docker", "kubernetes", "linux", "git", "github",
    "ci/cd", "jenkins", "terraform", "ansible",
    "data analysis", "data science", "machine learning", "deep learning",
    "tensorflow", "pytorch", "pandas", "numpy", "scikit-learn",
    "tableau", "power bi", "looker", "excel", "google sheets", "vba",
    "etl", "spark", "hadoop", "airflow",
    # Business / soft
    "communication", "leadership", "teamwork", "problem solving",
    "critical thinking", "time management", "project management",
    "stakeholder management", "negotiation", "presentation",
    # Functional
    "accounting", "auditing", "bookkeeping", "taxation", "ifrs", "gaap",
    "financial modelling", "financial analysis", "budgeting", "forecasting",
    "marketing", "digital marketing", "seo", "sem", "content marketing",
    "social media", "copywriting", "email marketing", "google ads",
    "sales", "business development", "crm", "salesforce", "hubspot",
    "customer service", "customer support", "client relations",
    "hr", "recruitment", "talent acquisition", "payroll",
    "supply chain", "logistics", "procurement", "inventory",
    "operations", "process improvement", "lean", "six sigma",
    "ux", "ui", "figma", "adobe xd", "sketch", "photoshop", "illustrator",
    "research", "qualitative research", "quantitative research",
    "graphic design", "video editing", "premiere", "after effects",
})

INDUSTRY_KEYWORDS = {
    "Technology / IT": [
        "software", "developer", "engineer", "data ", "devops", "cloud",
        "cybersecurity", "qa", "frontend", "backend", "full-stack", "fullstack",
        "machine learning", "ai ", "tech", "it ", "saas",
    ],
    "Banking / Finance": [
        "bank", "finance", "financial", "investment", "wealth", "loan",
        "credit", "treasury", "audit", "tax", "actuarial",
    ],
    "Accounting": ["accountant", "accounting", "bookkeep", "ifrs"],
    "Healthcare / Pharma": [
        "medical", "health", "hospital", "nurse", "pharmac", "clinical",
        "physician", "doctor", "biomed",
    ],
    "Telecommunications": ["telecom", "network engineer", "rf engineer", "mtn", "airtel", "glo"],
    "FMCG / Retail": ["fmcg", "retail", "consumer goods", "merchandiser", "supermarket"],
    "Oil & Gas / Energy": ["oil", "gas", "petroleum", "energy", "renewable", "solar"],
    "Manufacturing": ["manufactur", "production", "factory", "plant operator"],
    "Education": ["teacher", "tutor", "lecturer", "education", "school", "edtech"],
    "Marketing / Advertising": [
        "marketing", "brand", "advertising", "media buyer", "growth ",
        "digital marketer", "seo", "content marketer",
    ],
    "Sales": ["sales ", "sales executive", "sales representative", "business development"],
    "Logistics / Supply Chain": ["logistics", "supply chain", "warehouse", "fleet", "procurement"],
    "Human Resources": ["human resources", "hr ", "recruit", "talent acquisition", "people operations"],
    "Hospitality / Tourism": ["hotel", "hospitality", "tourism", "restaurant", "chef", "waiter"],
    "Construction / Real Estate": ["construction", "civil engineer", "real estate", "architect", "quantity surveyor"],
    "Legal": ["lawyer", "legal", "attorney", "paralegal", "compliance officer"],
    "Media / Creative": ["journalist", "editor", "photograph", "videograph", "creative", "designer"],
    "NGO / Non-profit": ["ngo", "non-profit", "nonprofit", "humanitarian", "program officer"],
    "Government / Public Sector": ["ministry", "government", "public sector", "civil service"],
    "Agriculture / Agritech": ["agric", "farm", "agronom", "agribusiness"],
}

REMOTE_HINTS = ("remote", "work from home", "wfh", "anywhere")
HYBRID_HINTS = ("hybrid",)
ONSITE_HINTS = ("on-site", "onsite", "on site", "in-office")


# ---------------------------------------------------------------------------
# Extraction helpers
# ---------------------------------------------------------------------------


def extract_years_experience(text: str) -> str:
    """Return a normalized experience descriptor from free text."""
    if not text:
        return ""
    lower = text.lower()

    if any(hint in lower for hint in ("no experience", "no prior experience", "entry-level", "entry level")):
        return "0 (entry-level)"
    if any(hint in lower for hint in ("graduate trainee", "fresh graduate", "trainee")):
        return "0 (graduate)"

    # Ranges: "2-3 years", "1 to 3 years"
    m = re.search(r"(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})\s*\+?\s*years?", lower)
    if m:
        return f"{m.group(1)}-{m.group(2)}"

    # Minimum: "minimum of 2 years", "at least 3 years"
    m = re.search(r"(?:minimum(?: of)?|at least|over)\s*(\d{1,2})\s*\+?\s*years?", lower)
    if m:
        return f"{m.group(1)}+"

    # Single value: "3 years experience"
    m = re.search(r"(\d{1,2})\s*\+?\s*years?\s*(?:of\s*)?(?:experience|exp)", lower)
    if m:
        return m.group(1)

    if "junior" in lower:
        return "0-2 (junior)"
    if "intern" in lower:
        return "0 (intern)"
    return ""


def extract_skills(text: str) -> str:
    if not text:
        return ""
    lower = text.lower()
    found = []
    for skill in SKILL_KEYWORDS:
        pattern = r"(?<![a-z0-9+#.])" + re.escape(skill) + r"(?![a-z0-9])"
        if re.search(pattern, lower):
            found.append(skill)
    return "; ".join(sorted(set(found)))


SALARY_RE = re.compile(
    r"(?P<cur>₦|N|NGN|USD|\$|€|£|GBP|EUR|KSh|R\b|ZAR)\s*"
    r"(?P<low>\d[\d,\.]{2,})"
    r"\s*(?:-|–|to)?\s*(?P<high>\d[\d,\.]{2,})?",
    re.IGNORECASE,
)


def extract_salary(text: str) -> str:
    if not text:
        return ""
    # Prefer a "salary" mention nearby
    salary_section = text
    m_label = re.search(r"salary[^a-z0-9]{0,5}(.{0,80})", text, re.IGNORECASE)
    if m_label:
        salary_section = m_label.group(1)
    m = SALARY_RE.search(salary_section)
    if not m:
        m = SALARY_RE.search(text)
    if not m:
        return ""
    cur = m.group("cur").upper().replace("N", "NGN") if m.group("cur") in ("N", "n") else m.group("cur")
    low = m.group("low")
    high = m.group("high")
    return f"{cur} {low}" + (f" - {high}" if high else "")


def detect_remote_type(text: str, location: str = "") -> str:
    blob = f"{text} {location}".lower()
    if any(h in blob for h in REMOTE_HINTS):
        return "remote"
    if any(h in blob for h in HYBRID_HINTS):
        return "hybrid"
    if any(h in blob for h in ONSITE_HINTS):
        return "onsite"
    return "unknown"


def classify_industry(*texts: str, hint: str = "") -> str:
    if hint:
        for label in INDUSTRY_KEYWORDS:
            if hint.lower() in label.lower():
                return label
        return hint
    blob = " ".join(t.lower() for t in texts if t)
    scores: dict[str, int] = {}
    for label, kws in INDUSTRY_KEYWORDS.items():
        for kw in kws:
            if kw in blob:
                scores[label] = scores.get(label, 0) + 1
    if not scores:
        return ""
    return max(scores.items(), key=lambda x: x[1])[0]


def parse_date_loose(text: str) -> str:
    """Parse a date string into ISO format, or return ''."""
    if not text:
        return ""
    text = text.strip()
    # Strip obvious labels
    text = re.sub(r"(?i)(application\s+)?deadline[:\s-]+", "", text)
    text = re.sub(r"(?i)(posted|date)\s*:?[\s-]*", "", text)
    # Common "X days ago" patterns
    rel = re.search(r"(\d+)\s+day", text.lower())
    if rel:
        days = int(rel.group(1))
        return (date.today().fromordinal(date.today().toordinal() - days)).isoformat()
    try:
        dt = date_parser.parse(text, fuzzy=True, dayfirst=True)
        return dt.date().isoformat()
    except (ValueError, OverflowError, TypeError):
        return ""


def days_until(iso_date: str) -> str:
    if not iso_date:
        return ""
    try:
        d = date.fromisoformat(iso_date)
    except ValueError:
        return ""
    return str((d - date.today()).days)


def is_entry_level(job: Job) -> bool:
    blob = f"{job.title} {job.description} {job.years_experience}".lower()
    if any(h in blob for h in ENTRY_LEVEL_HINTS):
        return True
    m = re.match(r"(\d+)", job.years_experience)
    if m and int(m.group(1)) <= 2:
        return True
    return False


# ---------------------------------------------------------------------------
# Hybrid session: requests first, Playwright fallback
# ---------------------------------------------------------------------------


class FetchSession:
    """Tries requests first; falls back to a headless Chromium if available."""

    def __init__(self, allow_browser: bool = True):
        self.allow_browser = allow_browser
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": random.choice(USER_AGENTS),
            "Accept-Language": "en-US,en;q=0.9",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        })
        self._playwright = None
        self._browser = None
        self._context = None
        self._last_request_ts = 0.0

    def _throttle(self):
        elapsed = time.time() - self._last_request_ts
        if elapsed < REQUEST_DELAY_SECONDS:
            time.sleep(REQUEST_DELAY_SECONDS - elapsed)
        self._last_request_ts = time.time()

    def get(self, url: str, force_browser: bool = False) -> Optional[str]:
        self._throttle()
        if not force_browser:
            try:
                resp = self.session.get(url, timeout=REQUEST_TIMEOUT)
                if resp.status_code == 200 and self._looks_useful(resp.text):
                    return resp.text
                log.debug("requests got %s on %s (len=%d), considering fallback",
                          resp.status_code, url, len(resp.text))
            except requests.RequestException as e:
                log.debug("requests failed for %s: %s", url, e)
        if self.allow_browser:
            return self._browser_get(url)
        return None

    def _looks_useful(self, html: str) -> bool:
        if not html or len(html) < 500:
            return False
        lowered = html.lower()
        blocked_hints = ("just a moment", "cf-chl", "captcha", "access denied", "are you a human")
        return not any(h in lowered for h in blocked_hints)

    def _browser_get(self, url: str) -> Optional[str]:
        try:
            self._ensure_browser()
        except Exception as e:
            log.warning("Playwright unavailable: %s", e)
            self.allow_browser = False
            return None
        try:
            page = self._context.new_page()
            page.goto(url, wait_until="domcontentloaded", timeout=30_000)
            try:
                page.wait_for_load_state("networkidle", timeout=8000)
            except Exception:
                pass
            html = page.content()
            page.close()
            return html
        except Exception as e:
            log.debug("Playwright fetch failed for %s: %s", url, e)
            return None

    def _ensure_browser(self):
        if self._browser is not None:
            return
        from playwright.sync_api import sync_playwright  # lazy
        self._playwright = sync_playwright().start()
        self._browser = self._playwright.chromium.launch(headless=True)
        self._context = self._browser.new_context(
            user_agent=random.choice(USER_AGENTS),
            locale="en-US",
            viewport={"width": 1366, "height": 800},
        )

    def close(self):
        try:
            if self._context: self._context.close()
            if self._browser: self._browser.close()
            if self._playwright: self._playwright.stop()
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Scrapers
# ---------------------------------------------------------------------------


class BaseScraper:
    name = "base"
    needs_browser = False
    supports_country_param = False

    def __init__(
        self,
        session: FetchSession,
        keyword: str = "",
        industry_hint: str = "",
        country: str = "Nigeria",
        max_pages: int = 2,
        entry_level_only: bool = True,
    ):
        self.session = session
        self.keyword = keyword.strip()
        self.industry_hint = industry_hint.strip()
        self.country = country
        self.max_pages = max_pages
        self.entry_level_only = entry_level_only

    def search(self) -> Iterator[Job]:
        raise NotImplementedError

    # ------------------------------------------------------------------ utils
    def _fetch(self, url: str) -> Optional[BeautifulSoup]:
        html = self.session.get(url, force_browser=self.needs_browser)
        if not html:
            return None
        return BeautifulSoup(html, "lxml")

    def _enrich(self, job: Job) -> Job:
        full_text = f"{job.title}\n{job.description}"
        if not job.years_experience:
            job.years_experience = extract_years_experience(full_text)
        if not job.skills:
            job.skills = extract_skills(full_text)
        if not job.salary:
            job.salary = extract_salary(full_text)
        if not job.remote_type:
            job.remote_type = detect_remote_type(full_text, job.location)
        if not job.industry:
            job.industry = classify_industry(job.title, job.description, hint=self.industry_hint)
        if not job.days_until_deadline:
            job.days_until_deadline = days_until(job.deadline)
        return job


class JobbermanScraper(BaseScraper):
    name = "Jobberman"
    base = "https://www.jobberman.com"

    def search(self) -> Iterator[Job]:
        q = quote_plus(self.keyword) if self.keyword else ""
        for page in range(1, self.max_pages + 1):
            url = f"{self.base}/jobs/entry-level?q={q}&page={page}" if q else f"{self.base}/jobs/entry-level?page={page}"
            soup = self._fetch(url)
            if not soup:
                log.warning("[%s] no content for page %s", self.name, page)
                return
            cards = soup.select("div.mqu-search-result, div[data-cy='listing-card'], article")
            if not cards:
                cards = soup.select("a[href*='/listings/']")
            log.info("[%s] page %s: %d cards", self.name, page, len(cards))
            for card in cards:
                yield from self._yield_card(card)

    def _yield_card(self, card) -> Iterator[Job]:
        link = card.find("a", href=True)
        if not link:
            return
        href = urljoin(self.base, link["href"])
        title_el = card.find(["h2", "h3", "p"], string=True) or link
        title = (title_el.get_text(strip=True) or "").strip()
        if not title:
            return
        company_el = card.find(string=re.compile(r"(?i)company|employer")) or card.select_one("p.text-loop")
        company = ""
        loc = ""
        meta_paragraphs = card.select("p")
        for p in meta_paragraphs:
            txt = p.get_text(" ", strip=True)
            if not txt:
                continue
            if not company and any(k in txt.lower() for k in ("ltd", "limited", "inc", "company")):
                company = txt
            if not loc and any(k in txt.lower() for k in ("lagos", "abuja", "ibadan", "kano", "ph ", "remote", "nigeria")):
                loc = txt
        job = Job(site=self.name, title=title, company=company, location=loc, url=href)
        job = self._fetch_detail(job)
        if job and (not self.entry_level_only or is_entry_level(job)):
            yield self._enrich(job)

    def _fetch_detail(self, job: Job) -> Optional[Job]:
        soup = self._fetch(job.url)
        if not soup:
            return job
        body = soup.select_one("article, main, div.job-description, div[class*='description']")
        if body:
            job.description = body.get_text("\n", strip=True)[:8000]
        # Deadline label
        m = re.search(r"(?i)application\s+deadline[:\s-]+([^\n]+)", soup.get_text("\n"))
        if m:
            job.deadline = parse_date_loose(m.group(1))
        m = re.search(r"(?i)(posted|date posted)[:\s-]+([^\n]+)", soup.get_text("\n"))
        if m:
            job.posting_date = parse_date_loose(m.group(2))
        return job


class MyJobMagScraper(BaseScraper):
    name = "MyJobMag"
    base = "https://www.myjobmag.com"

    def _country_path(self) -> str:
        # myjobmag has per-country subpaths; default to root for Nigeria
        country_paths = {
            "nigeria": "",
            "kenya": "/ke",
            "ghana": "/gh",
            "south africa": "/za",
            "uganda": "/ug",
        }
        return country_paths.get(self.country.lower(), "")

    def search(self) -> Iterator[Job]:
        cp = self._country_path()
        if self.keyword:
            base_url = f"{self.base}{cp}/search/jobs?title={quote_plus(self.keyword)}&years=0-1"
        else:
            base_url = f"{self.base}{cp}/jobs-by-experience/entry-level-jobs-in-nigeria"
        for page in range(1, self.max_pages + 1):
            url = base_url + (f"&page={page}" if "?" in base_url else f"?page={page}")
            soup = self._fetch(url)
            if not soup:
                return
            cards = soup.select("li.job-list-li, div.job-list-li, ul.job-list li")
            if not cards:
                cards = soup.select("h2 a[href*='/jobs/']")
            log.info("[%s] page %s: %d cards", self.name, page, len(cards))
            seen = set()
            for card in cards:
                a = card.find("a", href=True) if hasattr(card, "find") else card
                if not a or "href" not in getattr(a, "attrs", {}):
                    continue
                href = urljoin(self.base, a["href"])
                if href in seen:
                    continue
                seen.add(href)
                title = a.get_text(strip=True)
                if not title:
                    continue
                container = card if hasattr(card, "select") else card.find_parent()
                location = ""
                company = ""
                if container:
                    txt = container.get_text(" ", strip=True)
                    m_loc = re.search(r"(Lagos|Abuja|Kano|Ibadan|Port Harcourt|Remote|Nigeria)[^|]*", txt)
                    if m_loc:
                        location = m_loc.group(0).strip()
                    m_co = re.search(r"at\s+([A-Z][\w &.,'-]{2,80})", txt)
                    if m_co:
                        company = m_co.group(1).strip()
                job = Job(site=self.name, title=title, company=company, location=location, url=href)
                job = self._fetch_detail(job)
                if job and (not self.entry_level_only or is_entry_level(job)):
                    yield self._enrich(job)

    def _fetch_detail(self, job: Job) -> Optional[Job]:
        soup = self._fetch(job.url)
        if not soup:
            return job
        body = soup.select_one("div.job-details, div.job-description, article, main") or soup
        text = body.get_text("\n", strip=True)
        job.description = text[:8000]
        m = re.search(r"(?i)application\s+deadline[:\s-]+([^\n]+)", text)
        if m:
            job.deadline = parse_date_loose(m.group(1))
        m = re.search(r"(?i)(date posted|posted on)[:\s-]+([^\n]+)", text)
        if m:
            job.posting_date = parse_date_loose(m.group(2))
        return job


class HotNigerianJobsScraper(BaseScraper):
    name = "HotNigerianJobs"
    base = "https://www.hotnigerianjobs.com"

    def search(self) -> Iterator[Job]:
        if self.keyword:
            url = f"{self.base}/searchjobs.php?searchtext={quote_plus(self.keyword)}"
        else:
            url = f"{self.base}/graduate-trainee-jobs"
        soup = self._fetch(url)
        if not soup:
            return
        links = soup.select("a[href*='/hot-jobs/'], a[href*='/jobs/']")
        seen = set()
        log.info("[%s] %d candidate links", self.name, len(links))
        count = 0
        for a in links:
            if count >= 30 * self.max_pages:
                break
            href = urljoin(self.base, a["href"])
            if href in seen or "search" in href:
                continue
            seen.add(href)
            title = a.get_text(strip=True)
            if not title or len(title) < 6:
                continue
            job = Job(site=self.name, title=title, url=href)
            job = self._fetch_detail(job)
            if not job:
                continue
            if not self.entry_level_only or is_entry_level(job):
                yield self._enrich(job)
                count += 1

    def _fetch_detail(self, job: Job) -> Optional[Job]:
        soup = self._fetch(job.url)
        if not soup:
            return job
        text = (soup.select_one("article, div#content, main, body") or soup).get_text("\n", strip=True)
        job.description = text[:8000]
        m = re.search(r"(?i)application\s+deadline[:\s-]+([^\n]+)", text)
        if m:
            job.deadline = parse_date_loose(m.group(1))
        m = re.search(r"(?i)location[:\s-]+([^\n]+)", text)
        if m:
            job.location = m.group(1).strip()[:120]
        m = re.search(r"(?i)(company|employer)[:\s-]+([^\n]+)", text)
        if m:
            job.company = m.group(2).strip()[:160]
        m = re.search(r"(?i)(date posted|posted)[:\s-]+([^\n]+)", text)
        if m:
            job.posting_date = parse_date_loose(m.group(2))
        return job


class NgCareersScraper(BaseScraper):
    name = "NgCareers"
    base = "https://www.ngcareers.com"

    def search(self) -> Iterator[Job]:
        if self.keyword:
            url = f"{self.base}/search?q={quote_plus(self.keyword)}"
        else:
            url = f"{self.base}/jobs/graduate-trainee"
        soup = self._fetch(url)
        if not soup:
            return
        cards = soup.select("div.job-listing, article.job, li.job-item")
        if not cards:
            cards = soup.select("a[href*='/job/']")
        log.info("[%s] %d cards", self.name, len(cards))
        seen = set()
        for el in cards[: 30 * self.max_pages]:
            a = el.find("a", href=True) if hasattr(el, "find") else el
            if not a or "href" not in getattr(a, "attrs", {}):
                continue
            href = urljoin(self.base, a["href"])
            if href in seen:
                continue
            seen.add(href)
            title = a.get_text(strip=True)
            if not title:
                continue
            job = Job(site=self.name, title=title, url=href)
            job = self._fetch_detail(job)
            if job and (not self.entry_level_only or is_entry_level(job)):
                yield self._enrich(job)

    def _fetch_detail(self, job: Job) -> Optional[Job]:
        soup = self._fetch(job.url)
        if not soup:
            return job
        text = (soup.select_one("article, main, div.job-description") or soup).get_text("\n", strip=True)
        job.description = text[:8000]
        m = re.search(r"(?i)deadline[:\s-]+([^\n]+)", text)
        if m:
            job.deadline = parse_date_loose(m.group(1))
        m = re.search(r"(?i)location[:\s-]+([^\n]+)", text)
        if m:
            job.location = m.group(1).strip()[:120]
        m = re.search(r"(?i)company[:\s-]+([^\n]+)", text)
        if m:
            job.company = m.group(1).strip()[:160]
        return job


class JobgurusScraper(BaseScraper):
    name = "Jobgurus"
    base = "https://www.jobgurus.com.ng"

    def search(self) -> Iterator[Job]:
        if self.keyword:
            url = f"{self.base}/jobs?keyword={quote_plus(self.keyword)}"
        else:
            url = f"{self.base}/jobs/entry-level"
        soup = self._fetch(url)
        if not soup:
            return
        cards = soup.select("div.job-item, article.job, a[href*='/jobs/']")
        log.info("[%s] %d cards", self.name, len(cards))
        seen = set()
        for el in cards[: 30 * self.max_pages]:
            a = el.find("a", href=True) if hasattr(el, "find") else el
            if not a or "href" not in getattr(a, "attrs", {}):
                continue
            href = urljoin(self.base, a["href"])
            if href in seen or "/jobs?" in href:
                continue
            seen.add(href)
            title = a.get_text(strip=True)
            if not title or len(title) < 5:
                continue
            job = Job(site=self.name, title=title, url=href)
            job = self._fetch_detail(job)
            if job and (not self.entry_level_only or is_entry_level(job)):
                yield self._enrich(job)

    def _fetch_detail(self, job: Job) -> Optional[Job]:
        soup = self._fetch(job.url)
        if not soup:
            return job
        text = (soup.select_one("article, main, div.job-detail, div.job-description") or soup).get_text("\n", strip=True)
        job.description = text[:8000]
        m = re.search(r"(?i)deadline[:\s-]+([^\n]+)", text)
        if m:
            job.deadline = parse_date_loose(m.group(1))
        m = re.search(r"(?i)location[:\s-]+([^\n]+)", text)
        if m:
            job.location = m.group(1).strip()[:120]
        return job


class IndeedScraper(BaseScraper):
    """Indeed often serves Cloudflare/bot walls — Playwright fallback is critical."""
    name = "Indeed"
    needs_browser = True
    supports_country_param = True

    COUNTRY_HOSTS = {
        "nigeria": "ng.indeed.com",
        "ghana": "gh.indeed.com",
        "kenya": "ke.indeed.com",
        "south africa": "za.indeed.com",
        "united kingdom": "uk.indeed.com",
        "united states": "www.indeed.com",
        "usa": "www.indeed.com",
        "canada": "ca.indeed.com",
        "ireland": "ie.indeed.com",
        "australia": "au.indeed.com",
    }

    def _host(self) -> str:
        return self.COUNTRY_HOSTS.get(self.country.lower(), "www.indeed.com")

    def search(self) -> Iterator[Job]:
        host = self._host()
        q = quote_plus(self.keyword or "entry level")
        for page in range(self.max_pages):
            start = page * 10
            url = f"https://{host}/jobs?q={q}&explvl=entry_level&start={start}"
            soup = self._fetch(url)
            if not soup:
                log.warning("[%s] no content (likely blocked) on %s", self.name, url)
                return
            cards = soup.select("a.tapItem, a[data-jk], div.job_seen_beacon")
            log.info("[%s] page %s: %d cards", self.name, page + 1, len(cards))
            for card in cards:
                a = card if card.name == "a" else card.find("a", href=True)
                if not a:
                    continue
                href = a.get("href", "")
                if href.startswith("/"):
                    href = f"https://{host}{href}"
                title_el = card.select_one("h2 span[title], h2") or a
                title = (title_el.get("title") if title_el and title_el.has_attr("title") else title_el.get_text(strip=True)) or ""
                if not title:
                    continue
                company_el = card.select_one("span.companyName, [data-testid='company-name']")
                location_el = card.select_one("div.companyLocation, [data-testid='text-location']")
                snippet_el = card.select_one("div.job-snippet, [data-testid='job-snippet']")
                job = Job(
                    site=self.name,
                    title=title.strip(),
                    company=company_el.get_text(strip=True) if company_el else "",
                    location=location_el.get_text(strip=True) if location_el else "",
                    description=snippet_el.get_text(" ", strip=True) if snippet_el else "",
                    url=href,
                )
                if not self.entry_level_only or is_entry_level(job):
                    yield self._enrich(job)


SCRAPER_REGISTRY: dict[str, type[BaseScraper]] = {
    "jobberman": JobbermanScraper,
    "myjobmag": MyJobMagScraper,
    "hotnigerianjobs": HotNigerianJobsScraper,
    "ngcareers": NgCareersScraper,
    "jobgurus": JobgurusScraper,
    "indeed": IndeedScraper,
}


# ---------------------------------------------------------------------------
# CSV output
# ---------------------------------------------------------------------------


CSV_COLUMNS = [
    "site", "title", "company", "location", "remote_type", "industry",
    "years_experience", "skills", "salary", "posting_date", "deadline",
    "days_until_deadline", "description", "url", "scraped_at",
]


def write_csv(jobs: list[Job], path: str) -> None:
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS, quoting=csv.QUOTE_ALL)
        writer.writeheader()
        for job in jobs:
            row = asdict(job)
            # Collapse newlines in description for cleaner CSV
            row["description"] = (row.get("description") or "").replace("\r", " ").replace("\n", " | ")
            writer.writerow({k: row.get(k, "") for k in CSV_COLUMNS})


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Scrape entry-level job postings from Nigerian (and other) job boards.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("--country", default=None, help="Target country (e.g. Nigeria, Kenya). Default: Nigeria.")
    p.add_argument("--keyword", default=None, help="Job title or keyword filter (e.g. 'data analyst').")
    p.add_argument("--industry", default=None, help="Industry hint (also used to label rows when site doesn't expose it).")
    p.add_argument("--sites", default=None,
                   help="Comma-separated subset of: " + ",".join(SCRAPER_REGISTRY.keys()))
    p.add_argument("--pages", type=int, default=None, help="Pages per site (default: 2).")
    p.add_argument("--output", default=None, help="CSV output path (default: jobs_<timestamp>.csv).")
    p.add_argument("--no-browser", action="store_true",
                   help="Disable Playwright fallback (faster, will skip Indeed/JS sites).")
    p.add_argument("--all-experience", action="store_true",
                   help="Disable entry-level filter (return everything found).")
    p.add_argument("--non-interactive", action="store_true",
                   help="Skip prompts; use defaults / flags only.")
    p.add_argument("-v", "--verbose", action="store_true")
    return p.parse_args(argv)


def _prompt(label: str, default: str = "") -> str:
    suffix = f" [{default}]" if default else ""
    try:
        val = input(f"{label}{suffix}: ").strip()
    except EOFError:
        return default
    return val or default


def interactive(args: argparse.Namespace) -> argparse.Namespace:
    print("\n=== Entry-Level Job Scraper ===")
    print("Press Enter to accept the default in brackets.\n")
    if args.country is None:
        args.country = _prompt("Country", "Nigeria")
    if args.keyword is None:
        args.keyword = _prompt("Job title / keyword (blank = any)", "")
    if args.industry is None:
        args.industry = _prompt("Industry hint (blank = auto-classify)", "")
    if args.sites is None:
        print(f"\nAvailable sites: {', '.join(SCRAPER_REGISTRY)}")
        default = "jobberman,myjobmag,hotnigerianjobs,ngcareers,jobgurus,indeed"
        args.sites = _prompt("Sites (comma-separated)", default)
    if args.pages is None:
        try:
            args.pages = int(_prompt("Pages per site", "2"))
        except ValueError:
            args.pages = 2
    if args.output is None:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        args.output = _prompt("Output CSV", f"jobs_{ts}.csv")
    return args


def resolve_args(argv: list[str]) -> argparse.Namespace:
    args = parse_args(argv)
    if not args.non_interactive:
        args = interactive(args)
    # Final defaults for non-interactive paths
    args.country = args.country or "Nigeria"
    args.keyword = args.keyword or ""
    args.industry = args.industry or ""
    args.sites = args.sites or ",".join(SCRAPER_REGISTRY.keys())
    args.pages = args.pages or 2
    if not args.output:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        args.output = f"jobs_{ts}.csv"
    return args


def main(argv: Optional[list[str]] = None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    args = resolve_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )

    requested = [s.strip().lower() for s in args.sites.split(",") if s.strip()]
    unknown = [s for s in requested if s not in SCRAPER_REGISTRY]
    if unknown:
        log.warning("Ignoring unknown sites: %s", ", ".join(unknown))
    selected = [SCRAPER_REGISTRY[s] for s in requested if s in SCRAPER_REGISTRY]
    if not selected:
        log.error("No valid sites selected. Available: %s", ", ".join(SCRAPER_REGISTRY))
        return 2

    log.info("Country=%s | keyword=%r | industry=%r | sites=%s | pages=%d",
             args.country, args.keyword, args.industry,
             ",".join(s.name for s in selected), args.pages)

    session = FetchSession(allow_browser=not args.no_browser)
    all_jobs: list[Job] = []
    try:
        for cls in selected:
            log.info("--- Scraping %s ---", cls.name)
            scraper = cls(
                session=session,
                keyword=args.keyword,
                industry_hint=args.industry,
                country=args.country,
                max_pages=args.pages,
                entry_level_only=not args.all_experience,
            )
            try:
                for job in scraper.search():
                    all_jobs.append(job)
            except Exception as e:
                log.exception("[%s] crashed: %s — skipping site", cls.name, e)
    finally:
        session.close()

    # Deduplicate on (site, url) and (title, company)
    seen = set()
    unique: list[Job] = []
    for j in all_jobs:
        key = (j.site, j.url) if j.url else (j.title.lower(), j.company.lower())
        if key in seen:
            continue
        seen.add(key)
        unique.append(j)

    write_csv(unique, args.output)
    log.info("Wrote %d jobs (from %d raw) to %s", len(unique), len(all_jobs), os.path.abspath(args.output))
    print(f"\nDone. {len(unique)} unique jobs saved to: {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
