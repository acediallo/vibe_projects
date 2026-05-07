# Booksmart — Chrome Extension Technical Specification

## Project Overview

**Booksmart** is a lightweight Chrome extension that turns a messy bookmark collection into an organized, healthy, and instantly useful library. It audits dead links, flags stale bookmarks, surfaces what matters right now, and uses AI to suggest a cleaner folder structure — all running locally in the browser with zero backend.

**Target user**: The developer who built it (personal tool, may be published later).
**Build timeline**: Weekend project (2 days).
**Non-negotiable**: No backend, no user accounts, no database. Everything runs client-side via Chrome APIs and optional LLM calls.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│             Chrome Extension (Manifest V3)       │
│                    "Booksmart"                    │
├──────────┬─────────────┬────────────────────────┤
│  Popup   │  Side Panel │     Options Page       │
│  (React) │   (React)   │       (React)          │
│  300x500 │  Full dash  │   Full-page settings   │
├──────────┴─────────────┴────────────────────────┤
│            Service Worker (background.ts)         │
│  • BookmarkScanner — batch link health checks     │
│  • HistoryEnricher — visit count per bookmark     │
│  • AIProvider — model-agnostic LLM integration    │
│  • AlarmManager — scheduled auto-scans            │
├─────────────────────────────────────────────────┤
│                  Chrome APIs                      │
│  chrome.bookmarks  chrome.history                 │
│  chrome.storage    chrome.alarms                  │
│  chrome.sidePanel                                 │
└─────────────────────────────────────────────────┘
          │
          ▼ (HTTPS, user's own API key)
   OpenAI API (default: gpt-4o-mini)
   Model-agnostic — can swap to Gemini, Anthropic, Groq
```

---

## Tech Stack

| Layer              | Choice                  | Why                                          |
|--------------------|-------------------------|----------------------------------------------|
| Extension manifest | Chrome Manifest V3      | Required for Chrome Web Store                |
| UI framework       | React 18 + TypeScript   | Component reuse across popup/sidepanel       |
| Build tool         | Vite + CRXJS plugin     | Best DX for MV3 extensions with React + HMR  |
| Styling            | Tailwind CSS            | Fast, consistent, utility-first              |
| State management   | Zustand                 | Lightweight, minimal boilerplate             |
| Storage            | chrome.storage.local    | 10MB limit, sandboxed to extension           |
| AI integration     | OpenAI SDK (REST fetch) | gpt-4o-mini default, model-agnostic wrapper  |
| Link checking      | Fetch API (HEAD)        | Native browser API, no dependencies          |
| Icons              | Lucide React            | Lightweight, consistent icon set             |

---

## Chrome Extension Permissions

```json
{
  "manifest_version": 3,
  "name": "Booksmart",
  "version": "1.0.0",
  "description": "AI-powered bookmark manager — audit, organize, and surface what matters.",
  "permissions": [
    "bookmarks",
    "history",
    "storage",
    "alarms",
    "sidePanel"
  ],
  "host_permissions": [
    "https://api.openai.com/*",
    "https://generativelanguage.googleapis.com/*",
    "https://api.anthropic.com/*",
    "https://api.groq.com/*",
    "<all_urls>"
  ],
  "action": {
    "default_popup": "src/popup/index.html",
    "default_icon": {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },
  "side_panel": {
    "default_path": "src/sidepanel/index.html"
  },
  "background": {
    "service_worker": "src/background/index.ts",
    "type": "module"
  },
  "options_page": "src/options/index.html"
}
```

**Note on `<all_urls>`**: Required for HEAD requests to check any bookmarked URL. This triggers a Chrome Web Store review warning but is necessary for the core link-checking feature. For personal/unpacked use, this is fine.

---

## Data Models

All data is stored in `chrome.storage.local` as JSON.

### BookmarkMeta

Stored as a flat map keyed by Chrome bookmark ID: `{ "bookmarks_meta": { [id]: BookmarkMeta } }`

```typescript
interface BookmarkMeta {
  id: string;                      // Chrome bookmark ID
  title: string;                   // Bookmark title
  url: string;                     // Bookmark URL
  folderPath: string;              // e.g. "Bookmarks Bar/Dev/React"
  dateAdded: number;               // Timestamp from Chrome API
  lastChecked: number | null;      // Timestamp of last health check
  status: 'alive' | 'dead' | 'redirect' | 'timeout' | 'unknown' | 'unchecked';
  httpCode: number | null;         // HTTP status code from HEAD check
  lastVisited: number | null;      // Most recent visit from chrome.history
  visitCount: number;              // Total visits from chrome.history
  ageCategory: 'fresh' | 'aging' | 'stale' | 'ancient'; // Computed from dateAdded
}
```

Age categories:
- **fresh**: added < 30 days ago
- **aging**: 30–180 days ago
- **stale**: 180–365 days ago
- **ancient**: > 365 days ago

### Settings

Stored at key `"settings"`.

```typescript
interface Settings {
  aiProvider: 'openai' | 'gemini' | 'anthropic' | 'groq';
  aiApiKey: string | null;
  aiModel: string;                 // Default: 'gpt-4o-mini'
  autoScanInterval: 'daily' | 'weekly' | 'manual';
  staleThresholdDays: number;      // Default: 180
  maxConcurrentChecks: number;     // Default: 5
  lastFullScan: number | null;     // Timestamp
}
```

Default model per provider:
- `openai` → `gpt-4o-mini`
- `gemini` → `gemini-2.0-flash`
- `anthropic` → `claude-haiku-4-5-20251001`
- `groq` → `llama-3.3-70b-versatile`

### ReorgSuggestion

Stored as an array at key `"reorg_suggestions"`.

```typescript
interface ReorgSuggestion {
  id: string;                      // UUID
  createdAt: number;               // Timestamp
  suggestions: SuggestionItem[];
  status: 'pending' | 'partially_applied' | 'applied' | 'dismissed';
}

interface SuggestionItem {
  bookmarkId: string;
  bookmarkTitle: string;
  currentFolder: string;
  suggestedFolder: string;
  reason: string;
  applied: boolean;                // Track individual application
}
```

### ScanProgress

Stored at key `"scan_progress"` — ephemeral, used for UI updates.

```typescript
interface ScanProgress {
  isScanning: boolean;
  total: number;
  checked: number;
  currentUrl: string | null;
  startedAt: number | null;
}
```

---

## Core Modules (Service Worker)

### 1. BookmarkScanner

Reads all Chrome bookmarks, performs health checks via HEAD requests.

**Logic:**
1. Call `chrome.bookmarks.getTree()` to get the full bookmark tree.
2. Flatten recursively into an array of `{ id, title, url, folderPath, dateAdded }`. Skip folders and separator nodes (anything without a `url`).
3. For each bookmark with a URL, perform a health check:
   - `fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(8000) })`
   - If HEAD fails with a CORS or method-not-allowed error, retry with `GET` using `AbortSignal.timeout(8000)` and read zero body bytes.
   - Map HTTP codes: 200-299 → `alive`, 301/302/308 → `redirect`, 404/410 → `dead`, 429 → skip and retry later, 5xx → `dead`, timeout → `timeout`, CORS/network error → `unknown`.
4. Throttle: maximum 5 concurrent requests. 300ms delay between each new request launch. On 429 responses, exponential backoff (1s, 2s, 4s, max 3 retries then mark `unknown`).
5. After each check, update `chrome.storage.local` and broadcast progress via `chrome.runtime.sendMessage`.
6. Compute `ageCategory` from `dateAdded` relative to current date.

**Duplicate detection:**
After scanning, group bookmarks by normalized URL (strip trailing slash, strip `www.`, lowercase). Any URL appearing 2+ times is flagged as a duplicate.

### 2. HistoryEnricher

Enriches bookmark metadata with visit frequency data.

**Logic:**
1. For each bookmark URL, call `chrome.history.getVisits({ url })`.
2. Set `visitCount` = total number of visits.
3. Set `lastVisited` = most recent visit timestamp.
4. Run this after or in parallel with the health scan.

### 3. AIProvider (Model-Agnostic)

Handles communication with LLM APIs for bookmark reorganization.

```typescript
interface AIProvider {
  reorganize(bookmarks: BookmarkData[]): Promise<SuggestionItem[]>;
}
```

**Implementation pattern:**

```typescript
// Abstract the API call — each provider is a function
// that takes the same prompt and returns the same JSON structure.

type ProviderFn = (systemPrompt: string, userPrompt: string, apiKey: string, model: string) => Promise<string>;

const providers: Record<string, ProviderFn> = {
  openai: callOpenAI,
  gemini: callGemini,
  anthropic: callAnthropic,
  groq: callGroq,
};
```

**Chunking strategy:**
- Chrome bookmarks can number in the hundreds or thousands.
- Chunk bookmarks into batches of **100 bookmarks per API call**.
- Each batch sends titles + URLs + current folder paths (no page content).
- Estimated tokens per batch: ~3K input, ~2K output.

**System prompt for reorganization:**

```
You are a bookmark organization expert. Your job is to suggest a clean,
intuitive folder structure for a collection of browser bookmarks.

Rules:
- Maximum 2 levels of folder nesting (e.g. "Tech/Frontend" is ok, "Tech/Frontend/React/Hooks" is too deep).
- Group by topic or theme, not by source website.
- Use clear, concise folder names in English.
- If a bookmark seems outdated or irrelevant, suggest the folder "_Archive" with a reason.
- Preserve any folder assignments that already make sense — do not move bookmarks unnecessarily.

Respond with ONLY a valid JSON array. No markdown, no explanation, no preamble.
Each item in the array:
{
  "bookmarkId": "<the id provided>",
  "suggestedFolder": "<new folder path>",
  "reason": "<one sentence explaining why>"
}

Only include bookmarks that should be MOVED. If a bookmark is already well-placed, omit it from the output.
```

**User prompt per batch:**

```
Here are my bookmarks. Each has an id, title, URL, and current folder.
Suggest reorganization.

[
  { "id": "123", "title": "React Docs", "url": "https://react.dev", "currentFolder": "Misc" },
  ...
]
```

**OpenAI-specific call (default):**

```typescript
async function callOpenAI(systemPrompt: string, userPrompt: string, apiKey: string, model: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3, // Low temp for consistent JSON output
      response_format: { type: 'json_object' }, // OpenAI JSON mode
    }),
  });

  const data = await response.json();
  return data.choices[0].message.content;
}
```

For other providers, adapt the endpoint and headers but keep the same prompt structure. Gemini uses `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` with the API key as a query parameter. Groq uses `https://api.groq.com/openai/v1/chat/completions` with the same OpenAI-compatible format.

### 4. AlarmManager

Handles scheduled automatic scans using `chrome.alarms`.

**Logic:**
- On extension install and on settings change, create/update an alarm:
  - `daily` → `chrome.alarms.create('autoScan', { periodInMinutes: 1440 })`
  - `weekly` → `chrome.alarms.create('autoScan', { periodInMinutes: 10080 })`
  - `manual` → `chrome.alarms.clear('autoScan')`
- On alarm fire, run BookmarkScanner + HistoryEnricher.
- Store `lastFullScan` timestamp in settings.

---

## User Flows

### Flow 1: First Run (Onboarding)

1. User installs extension or loads unpacked.
2. Clicking the extension icon opens the **popup**.
3. Popup shows a welcome card: "Welcome to Booksmart. Let's clean up your bookmarks."
4. Two actions:
   - "Set up AI features" → opens Options page to enter API key.
   - "Run your first scan" → triggers BookmarkScanner from popup. Progress is shown inline.
5. After first scan completes, popup transitions to the normal Smart Shelf view.

### Flow 2: Health Audit (Side Panel — Health Tab)

1. User opens side panel (right-click extension icon → "Open side panel", or via popup button).
2. Health tab is the default view.
3. Top row: 4 summary cards — **Alive** (green), **Dead** (red), **Stale** (amber), **Duplicates** (blue). Each shows a count.
4. Below: a sortable, filterable table with columns: Status icon | Title | URL (truncated) | Folder | Age | Last Checked.
5. Filters above the table: dropdown for status, dropdown for age category, text search.
6. Each row has a checkbox for bulk selection.
7. Bulk action bar (appears when items selected): "Delete Selected", "Move to _Archive", "Re-check Selected".
8. "Scan Now" button in the header to trigger a fresh scan. Shows a progress bar during scan.

### Flow 3: AI Reorganization (Side Panel — Organize Tab)

1. User navigates to the Organize tab.
2. Left section: current folder tree with bookmark count per folder.
3. Big button: "Suggest Reorganization with AI" (disabled if no API key — shows "Set up API key in Settings").
4. On click: loading state with "Analyzing your bookmarks..." message.
5. Results appear as a list of suggestion cards:
   - Each card: Bookmark title | Current folder → Suggested folder | Reason
   - Each card has: "Apply" button (green), "Dismiss" button (gray).
6. Top of the list: "Apply All Suggestions" button, "Dismiss All" button.
7. Applying a suggestion calls `chrome.bookmarks.move()` to the suggested folder. If the folder doesn't exist, create it with `chrome.bookmarks.create()`.
8. Applied suggestions are marked as done and grayed out.

### Flow 4: Smart Shelf (Popup — Daily Use)

This is the primary daily interface — fast, lightweight, no API calls.

1. **Search bar** (top): instant search across all bookmark titles and URLs. Results update as user types (debounced 200ms).
2. **Recent** section: bookmarks added in the last 7 days, sorted newest first. Max 10 shown.
3. **Most Used** section: top 10 bookmarks by visit count. Shows visit count badge.
4. **Needs Attention** badge (bottom): "5 dead links, 23 stale bookmarks" — clickable, opens side panel Health tab.
5. Each bookmark row: favicon (from `https://www.google.com/s2/favicons?domain={domain}&sz=16`), title (truncated to 40 chars), folder tag (small, muted). Click opens in new tab. Hover shows delete icon.

### Flow 5: Settings (Options Page / Side Panel Settings Tab)

1. **AI Provider** dropdown: OpenAI (default) | Gemini | Anthropic | Groq.
2. **AI Model** text field: auto-populated with default model for selected provider, editable.
3. **API Key** input: password-masked, with show/hide toggle. "Test Key" button that makes a minimal API call to validate the key.
4. **Auto-Scan Schedule**: Daily | Weekly | Manual (default: Manual).
5. **Stale Threshold**: slider, 30–365 days, default 180.
6. **Danger Zone**: "Clear all Booksmart data" button (clears chrome.storage.local metadata only, does NOT delete actual bookmarks).

---

## Component Hierarchy

```
src/
├── background/
│   ├── index.ts                    # Service worker entry
│   ├── bookmark-scanner.ts         # Health check engine
│   ├── history-enricher.ts         # Visit count enrichment
│   ├── ai-provider.ts              # Model-agnostic AI wrapper
│   │   ├── openai.ts               # OpenAI provider
│   │   ├── gemini.ts               # Gemini provider (stub for v1)
│   │   ├── anthropic.ts            # Anthropic provider (stub for v1)
│   │   └── groq.ts                 # Groq provider (stub for v1)
│   ├── alarm-manager.ts            # Scheduled scan management
│   └── message-handler.ts          # chrome.runtime message router
│
├── shared/
│   ├── types.ts                    # All TypeScript interfaces
│   ├── constants.ts                # Default settings, thresholds
│   ├── store.ts                    # Zustand store definition
│   └── utils.ts                    # URL normalization, date helpers
│
├── popup/
│   ├── index.html
│   ├── index.tsx                   # React entry
│   ├── App.tsx
│   ├── components/
│   │   ├── SmartShelf.tsx          # Main popup view
│   │   ├── SearchBar.tsx           # Instant bookmark search
│   │   ├── BookmarkRow.tsx         # Single bookmark display
│   │   ├── RecentSection.tsx       # Last 7 days bookmarks
│   │   ├── FrequentSection.tsx     # Top 10 most visited
│   │   ├── AttentionBadge.tsx      # Dead/stale count link
│   │   └── WelcomeCard.tsx         # First-run onboarding
│   └── styles.css                  # Tailwind entry
│
├── sidepanel/
│   ├── index.html
│   ├── index.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── TabNav.tsx              # Health | Organize | Settings tabs
│   │   ├── health/
│   │   │   ├── HealthTab.tsx       # Main health view
│   │   │   ├── SummaryCards.tsx    # Alive/dead/stale/duplicate counts
│   │   │   ├── BookmarkTable.tsx   # Sortable, filterable table
│   │   │   ├── BookmarkTableRow.tsx
│   │   │   ├── FilterBar.tsx       # Status + age + search filters
│   │   │   ├── BulkActionBar.tsx   # Delete/move/recheck selected
│   │   │   └── ScanProgressBar.tsx
│   │   ├── organize/
│   │   │   ├── OrganizeTab.tsx     # Main organize view
│   │   │   ├── FolderTree.tsx      # Current folder structure
│   │   │   ├── SuggestionList.tsx  # AI suggestion cards
│   │   │   └── SuggestionCard.tsx  # Single move suggestion
│   │   └── settings/
│   │       └── SettingsTab.tsx     # Inline settings (mirrors Options)
│   └── styles.css
│
├── options/
│   ├── index.html
│   ├── index.tsx
│   └── OptionsPage.tsx             # Full-page settings
│
└── assets/
    └── icons/                      # 16, 48, 128px extension icons
```

---

## UI Design Direction

**Aesthetic**: Clean, utilitarian, with a hint of warmth. Think "Notion meets a developer tool."

- **Color palette**: Dark sidebar/header (#1a1a2e), light content area (#fafafa). Accent: warm amber (#f59e0b) for actions and highlights. Status colors: green (#22c55e) for alive, red (#ef4444) for dead, amber (#f59e0b) for stale, blue (#3b82f6) for duplicates/info.
- **Typography**: System font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`). Keep it native and fast — no external font loading in an extension.
- **Popup**: Compact (360px × 520px). No wasted space. Favicon + title + folder on each row.
- **Side Panel**: Full height, ~400px wide. Card-based layout for summary stats. Clean table with subtle row hover.

---

## Error Handling Strategy

| Scenario | Handling |
|---|---|
| No API key set | AI features disabled, show "Set up API key" prompt. All non-AI features work normally. |
| Invalid API key | Show error toast on test. Don't save invalid key. |
| API rate limit (429) | Show "Rate limited, try again in a few minutes" toast. |
| HEAD request blocked by CORS | Retry with GET. If still fails, mark as `unknown` (not `dead`). |
| HEAD request timeout (8s) | Mark as `timeout`. Show differently from `dead` in UI. |
| chrome.storage.local quota (10MB) | Monitor usage. If > 8MB, warn user and suggest clearing old scan data. |
| Service worker killed by Chrome | MV3 service workers can be terminated. Use chrome.storage for all state (not in-memory). Resume scan from last checked bookmark on restart. |
| Bookmark deleted externally | On scan or UI load, reconcile stored metadata with actual chrome.bookmarks. Remove orphaned metadata entries. |
| AI returns malformed JSON | Wrap JSON.parse in try/catch. Show "AI returned unexpected format, try again" message. Log raw response for debugging. |

---

## Security Considerations

1. **API key storage**: Keys are stored in `chrome.storage.local`, which is sandboxed to the extension and inaccessible to web pages or other extensions. This is sufficient for a personal tool. Do NOT store keys in `chrome.storage.sync` (syncs to Google account, increases exposure surface).

2. **API calls from service worker only**: All LLM API calls happen in the background service worker, never from the popup or side panel directly. This keeps keys out of any page-accessible context.

3. **No sensitive data sent to AI**: Only bookmark titles, URLs, and folder names are sent to the LLM. No page content, no browsing history, no personal data.

4. **Link checking respects servers**: Throttled to 5 concurrent requests, 300ms spacing, exponential backoff on 429. This prevents being flagged as abusive by target servers.

5. **Content Security Policy**: Manifest V3 enforces strict CSP by default. No inline scripts, no eval(), no remote code execution.

---

## Implementation Sequence for Claude Code

Execute these prompts in order. Each builds on the previous.

### Prompt 1 — Project Scaffolding

```
Create a Chrome extension called "Booksmart" using Manifest V3, React 18, TypeScript,
Vite, CRXJS Vite plugin, Tailwind CSS, and Zustand.

Project structure:
- src/popup/ (React app, 360x520px popup)
- src/sidepanel/ (React app, full dashboard)
- src/options/ (React app, full-page settings)
- src/background/ (service worker, TypeScript)
- src/shared/ (types, constants, store, utils)
- src/assets/icons/ (placeholder PNGs for 16, 48, 128)

Set up the manifest.json with permissions: bookmarks, history, storage, alarms, sidePanel.
Host permissions: https://api.openai.com/*, https://generativelanguage.googleapis.com/*,
https://api.anthropic.com/*, https://api.groq.com/*, <all_urls>.

Configure Tailwind with these custom colors:
- surface-dark: #1a1a2e
- surface-light: #fafafa
- accent: #f59e0b (amber)
- status-alive: #22c55e
- status-dead: #ef4444
- status-stale: #f59e0b
- status-duplicate: #3b82f6
- status-unknown: #9ca3af

Use system font stack. Verify the extension builds and loads in chrome://extensions.
```

### Prompt 2 — Shared Types and Store

```
In src/shared/, create:

1. types.ts — Define all TypeScript interfaces: BookmarkMeta, Settings, ReorgSuggestion,
   SuggestionItem, ScanProgress. Use the exact interfaces from the spec document.

2. constants.ts — Default settings (openai, gpt-4o-mini, manual scan, 180 day threshold,
   5 concurrent checks), age thresholds (fresh<30, aging<180, stale<365, ancient>=365),
   default model per provider map.

3. store.ts — Zustand store that reads/writes to chrome.storage.local.
   State: bookmarksMeta (map), settings, scanProgress, reorgSuggestions.
   Actions: loadFromStorage, saveSettings, updateBookmarkMeta, clearAllData.
   The store should hydrate from chrome.storage.local on initialization and persist
   changes back to storage on every mutation.

4. utils.ts — Helper functions:
   - normalizeUrl(url): strip trailing slash, strip www., lowercase, strip protocol
   - getAgeCategory(dateAdded): returns fresh/aging/stale/ancient
   - getFaviconUrl(url): returns Google favicon service URL
   - truncateString(str, maxLen): truncate with ellipsis
   - generateId(): crypto.randomUUID() wrapper
   - formatTimeAgo(timestamp): "2 days ago", "3 months ago" etc.
```

### Prompt 3 — Bookmark Scanner + History Enricher

```
In src/background/, implement:

1. bookmark-scanner.ts — BookmarkScanner class:
   - scanAll(): reads chrome.bookmarks.getTree(), flattens into bookmark array
     (skip nodes without url), then health-checks each URL.
   - Health check per URL: HEAD request with 8s timeout. If HEAD fails with
     TypeError/CORS, retry with GET (8s timeout, don't read body). Map HTTP codes:
     2xx → alive, 3xx → redirect, 404/410 → dead, 429 → retry with backoff,
     5xx → dead, timeout → timeout, network/CORS error → unknown.
   - Throttle: max 5 concurrent requests, 300ms between launches.
     Exponential backoff on 429 (1s, 2s, 4s, max 3 retries then unknown).
   - Broadcast progress via chrome.runtime.sendMessage after each check.
   - Store results incrementally in chrome.storage.local (don't wait for full scan).
   - Detect duplicates: group by normalizeUrl(), flag groups with 2+ entries.
   - Must be resumable: if service worker dies, read last state from storage
     and continue from where it left off.

2. history-enricher.ts — HistoryEnricher class:
   - enrichAll(bookmarkMetas): for each bookmark, call chrome.history.getVisits({url}).
   - Set visitCount and lastVisited on each BookmarkMeta.
   - Run after scan completes or on demand.

3. alarm-manager.ts — AlarmManager:
   - setupAlarm(interval): create/update chrome.alarms based on settings.
   - On alarm fire, trigger scanAll() + enrichAll().

4. message-handler.ts — Route messages from popup/sidepanel to the right module.
   Message types: START_SCAN, GET_PROGRESS, REQUEST_REORG, APPLY_SUGGESTION, TEST_API_KEY.

5. index.ts — Service worker entry. Initialize AlarmManager, register message handler,
   listen for chrome.alarms.onAlarm.
```

### Prompt 4 — AI Provider (Model-Agnostic)

```
In src/background/ai-provider.ts, implement a model-agnostic AI layer:

1. Define a ProviderFn type: (systemPrompt, userPrompt, apiKey, model) => Promise<string>

2. Implement callOpenAI provider function:
   - POST to https://api.openai.com/v1/chat/completions
   - Use response_format: { type: 'json_object' } for reliable JSON
   - Temperature 0.3
   - Bearer token auth

3. Implement callGemini provider function:
   - POST to https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
   - API key as query param ?key={apiKey}
   - Wrap prompt in contents[].parts[].text format

4. Implement callGroq provider function:
   - POST to https://api.groq.com/openai/v1/chat/completions
   - Same OpenAI-compatible format
   - Bearer token auth

5. Implement callAnthropic provider function:
   - POST to https://api.anthropic.com/v1/messages
   - x-api-key header, anthropic-version: 2023-06-01
   - System prompt as system field, user prompt in messages array

6. Main function: reorganizeBookmarks(bookmarks, settings):
   - Chunk bookmarks into batches of 100.
   - For each batch, build the system prompt and user prompt as specified in the spec.
   - Call the provider function matching settings.aiProvider.
   - Parse JSON response, validate structure, merge all batch results.
   - Return SuggestionItem[] — only bookmarks that should move.
   - Wrap everything in try/catch. On malformed JSON, retry once. On second failure,
     throw with a user-friendly message.

7. testApiKey(provider, apiKey, model) function:
   - Make a minimal API call ("respond with {ok: true}") to validate the key works.
   - Return { success: boolean, error?: string }.
```

### Prompt 5 — Popup UI (Smart Shelf)

```
Build the popup UI in src/popup/:

Size: 360px wide, 520px tall max. Scrollable if content exceeds.

Layout (top to bottom):
1. Header: "Booksmart" logo/text (left), gear icon linking to options (right).
   Subtle dark background (#1a1a2e), white text.

2. SearchBar: full-width input with search icon. Debounced 200ms.
   When active, replaces the sections below with filtered results.

3. RecentSection: "Recent" heading with small count badge.
   List of bookmarks added in last 7 days, newest first, max 10.
   Each BookmarkRow: favicon (16px) | title (truncated 40ch) | folder tag (muted, small).
   Click → chrome.tabs.create({ url }). Hover → show trash icon for delete.

4. FrequentSection: "Most Used" heading.
   Top 10 by visitCount. Same BookmarkRow format but with visit count badge.

5. AttentionBadge: bottom bar, amber background.
   "X dead links · Y stale bookmarks" — clickable, opens side panel.
   Only shows if dead > 0 or stale > 0. Hidden on first run before any scan.

6. WelcomeCard: shown only if no scan has ever been run (lastFullScan === null).
   "Welcome to Booksmart" with brief tagline and two buttons:
   "Set up AI" (opens options), "Run first scan" (triggers scan, shows progress).

Data loading: on popup open, read from chrome.storage.local via Zustand store.
No API calls from popup — everything is pre-computed from stored metadata.
```

### Prompt 6 — Side Panel Dashboard

```
Build the side panel in src/sidepanel/:

Full height, ~400px wide default (Chrome controls the width).

TabNav at top: three tabs — Health (default) | Organize | Settings.
Use a simple tab state, not a router.

HEALTH TAB:
- Top row: 4 SummaryCards in a 2x2 grid.
  Each card: big number + label + colored left border.
  Alive (green) | Dead (red) | Stale (amber) | Duplicates (blue).
- "Scan Now" button (top right). Disabled during scan, shows ScanProgressBar.
  ScanProgressBar: thin bar + "Checking 45 of 312..." text.
- BookmarkTable below the cards. Columns: checkbox | status icon | title | URL | folder | age.
  Sortable by clicking column headers (status, title, age).
- FilterBar above table: status dropdown (all/alive/dead/redirect/timeout/unknown),
  age dropdown (all/fresh/aging/stale/ancient), text search input.
- BulkActionBar: appears fixed at bottom when checkboxes selected.
  "X selected" count | "Delete" button (red) | "Move to _Archive" button | "Re-check" button.
  Delete calls chrome.bookmarks.remove() for each selected.
  Archive moves to a "_Booksmart Archive" folder (create if not exists).

ORGANIZE TAB:
- Left: FolderTree showing current bookmark folder hierarchy.
  Each folder node: folder name + bookmark count. Expandable/collapsible.
- Right/below: "Suggest Reorganization" button (large, amber accent).
  If no API key: button disabled, shows "Set up your API key in Settings to use AI features."
  On click: loading spinner + "Analyzing X bookmarks..."
  On complete: SuggestionList appears.
- SuggestionList: list of SuggestionCards.
  Each SuggestionCard: bookmark title, current folder → suggested folder (with arrow),
  reason text (small, muted), "Apply" button (green), "Dismiss" button (gray).
- Top of list: "Apply All (X)" button | "Dismiss All" button.
- Applied cards get grayed out with a checkmark.

SETTINGS TAB:
- Same form as Options page (reuse component).
- AI Provider dropdown, Model text field, API Key masked input with Test button,
  Auto-scan schedule radio, Stale threshold slider, Clear Data button.
```

### Prompt 7 — Options Page + Polish + Build

```
Build src/options/OptionsPage.tsx — same settings form as the Settings Tab
in the side panel. Reuse the settings component if possible (extract to shared).

Then polish the full extension:
1. Add empty states: "No bookmarks scanned yet" for Health tab,
   "Run a scan first" for Organize tab when no metadata exists.
2. Add toast notifications (simple, auto-dismiss after 3s) for:
   - "Scan complete: X alive, Y dead, Z stale"
   - "API key verified successfully" / "Invalid API key"
   - "X suggestions applied"
   - "X bookmarks deleted"
3. Add error boundaries around each tab to prevent full-app crashes.
4. Ensure all chrome.storage.local reads are wrapped in try/catch.
5. Add a "last scanned: 2 hours ago" timestamp in the Health tab header.
6. Generate simple SVG placeholder icons (16, 48, 128px) with a bookmark
   + sparkle motif in the amber accent color on a dark background.

Verify the final build:
- npm run build produces a dist/ folder
- The extension loads in chrome://extensions as unpacked
- Popup opens, side panel opens, options page opens
- No console errors on any page
```

---

## Testing Checklist

Run these manually after the build:

1. [ ] Extension loads without errors in `chrome://extensions` (developer mode)
2. [ ] Popup shows welcome card on first run (no scan data)
3. [ ] Bookmark scan starts from popup, progress updates in real time
4. [ ] Scan completes — summary cards show correct counts
5. [ ] Dead links correctly identified (test: bookmark a known 404 URL like `https://httpstat.us/404`)
6. [ ] Stale/fresh classification matches bookmark age
7. [ ] Duplicate detection works (add two bookmarks to the same URL)
8. [ ] Bulk delete actually removes bookmarks from Chrome (verify in `chrome://bookmarks`)
9. [ ] Bulk archive moves bookmarks to `_Booksmart Archive` folder
10. [ ] AI reorganization returns suggestions (with valid OpenAI API key)
11. [ ] Applying a suggestion moves the bookmark and creates the folder if needed
12. [ ] Dismissing a suggestion grays it out
13. [ ] Smart Shelf (popup) shows recent bookmarks from last 7 days
14. [ ] Most Used section shows bookmarks sorted by visit count
15. [ ] Search bar filters bookmarks instantly
16. [ ] Settings save and persist across extension restarts
17. [ ] "Test API Key" validates correctly (valid key → success, gibberish → error)
18. [ ] Extension works with 500+ bookmarks without UI freeze
19. [ ] Scheduled scan fires correctly (set to daily, verify alarm in service worker logs)
20. [ ] "Clear all data" removes metadata but does NOT delete actual bookmarks

---

## Future Roadmap (NOT for weekend build)

**v1.5 — Quality of Life**
- Keyboard shortcuts (Ctrl+Shift+B to open side panel)
- Export dead links as CSV
- Undo last bulk action
- Dark mode toggle

**v2 — Intelligence Layer**
- Auto-scrape bookmarked pages and store AI-generated summaries
- Weekly email/notification digest: "5 links died this week, 3 new bookmarks organized"
- ML-based "related bookmarks" suggestions when browsing
- Tag system (user-defined + AI-suggested)

**v3 — Monetization (if demand exists)**
- Backend sync (Firebase) for cross-device bookmarks
- Team shared collections
- Chrome Web Store listing ($5/month subscription via Stripe)
- Advanced AI: classify bookmarks by reading page content, not just title/URL
