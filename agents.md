# Mapz — Agent Notes

## One-liner
Chrome Manifest V3 extension (vanilla JS, no build) that detects addresses/places on a page and opens them in Google Maps via a side panel.

## Run it
```
# No build step. Load unpacked:
# 1. Open chrome://extensions
# 2. Enable Developer mode
# 3. Load unpacked  ->  select this folder
# 4. After edits: click the refresh icon on the Mapz card in chrome://extensions
```

## Where we are right now
- Last touched: 2026-04-16
- Working on: Dormant — single initial commit, stable v0.2.0.
- Known broken: Nothing known. `README.md` is currently untracked (see `git status`).

*This section goes stale fast. Check `git log -5` and `git status` before trusting it.*

## Gotchas
- **No API key, by design.** Don't introduce anything that needs credentials — Google Maps is invoked via plain URL patterns (`/maps/search/?api=1&query=` for single, `/maps/dir/...` for multi-stop). README's "Get a Google Maps API key" section is outdated; Embed API is not used.
- **Side panel must open from a user gesture.** `chrome.sidePanel.open({ tabId })` is called from inside `chrome.action.onClicked` in `background.js`; moving it out of that handler breaks the open.
- **Re-render on re-click while panel is open.** `background.js` writes a `lastUpdated` timestamp to `chrome.storage.session`; `map.js` listens via `chrome.storage.session.onChanged` and re-renders without a reload. Don't drop the timestamp write.
- **Extraction fallback order matters** (content.js): JSON-LD -> regex (only if JSON-LD < 3 hits) -> microdata -> TripAdvisor-specific selectors -> headings (only if < 5 place names). Reordering changes real-site results.
- **`vendor/leaflet/` is dead code** from v0.1.0 — nothing references it. Safe to delete, left in tree.
- **No build / no bundler / no TS.** Plain ES2020+ loaded directly by Chrome. Don't add npm without asking.

## Non-obvious conventions
- Place names without an address get the inferred location context (URL slug or page title) appended before being passed to Google Maps, e.g. `"Mike's Pastry, Boston, MA"`.
- Multi-stop Google Maps URL is capped at 10 stops.

See README.md for project description, tech stack, and feature list.
