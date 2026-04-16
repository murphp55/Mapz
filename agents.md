# Mapz — AI Agent Context

## What this is
A Chrome/Chromium browser extension (Manifest V3) that detects addresses and place names on the current web page and opens them in Google Maps via a side panel.

## Core user flow
1. User visits a page with addresses or places (e.g. TripAdvisor, Yelp, a restaurant list)
2. User clicks the Mapz extension icon
3. A side panel opens listing all detected locations
4. Each item has a Google Maps link (↗) to open it individually
5. A "View all on Google Maps" button opens up to 10 locations as a directions route

## Tech stack
- Vanilla JS, HTML, CSS — no build step, no bundler, no framework
- Chrome Extension APIs: `chrome.action`, `chrome.sidePanel`, `chrome.storage.session`, `chrome.tabs`, `chrome.runtime`
- No external map libraries (Leaflet was removed in v0.2.0)
- No geocoding — Google Maps handles that via URL
- No API keys required

## File structure
```
manifest.json     Extension config (MV3), declares sidePanel, permissions, content script
background.js     Service worker — handles icon click, extracts data, opens side panel
content.js        Injected into every page — extracts addresses and place names
map.html          Side panel UI shell
map.js            Side panel logic — reads storage, builds Google Maps URLs, renders list
map.css           Side panel styles
vendor/leaflet/   Leaflet.js (bundled but no longer used — safe to delete)
agents.md         This file
```

## Data flow
```
icon click
  → background.js sends EXTRACT_ADDRESSES message to content.js
  → content.js returns { addresses[], placeNames[], context }
  → background.js stores in chrome.storage.session + sets lastUpdated timestamp
  → background.js calls chrome.sidePanel.open({ tabId })
  → map.js reads storage on DOMContentLoaded
  → map.js also listens for storage.onChanged (lastUpdated key) to re-render if panel already open
```

## Extraction strategy (content.js, priority order)
1. **JSON-LD** (`<script type="application/ld+json">`) — most reliable; parses Schema.org types like LocalBusiness, Restaurant, TouristAttraction, etc. Extracts `name` → placeNames, `address` → addresses
2. **Regex** — street address pattern (number + suffix + optional city/state/zip); used if JSON-LD yields fewer than 3 addresses
3. **Microdata** — `[itemtype*='LocalBusiness']` etc. selectors; fallback for place names
4. **TripAdvisor-specific** — `<a href>` links containing `Attraction_Review` etc.
5. **Headings** (`h2`, `h3`) — last resort for place names if fewer than 5 found

## Google Maps URL patterns used
- Single location: `https://www.google.com/maps/search/?api=1&query=ENCODED_QUERY`
- Multiple locations (≤10): `https://www.google.com/maps/dir/STOP1/STOP2/...`
- For place names without an address, the inferred location context (from URL slug or page title) is appended: `"Mike's Pastry, Boston, MA"`

## Key constraints / gotchas
- **No API key** — the extension works out of the box for anyone; don't add anything that requires credentials
- **Side panel** requires the `sidePanel` permission in manifest and `chrome.sidePanel.open()` from a user gesture handler (`chrome.action.onClicked`)
- **Re-render on re-click**: the panel stays open between icon clicks; `map.js` listens to `chrome.storage.session.onChanged` for the `lastUpdated` key to detect new data and re-render without a full page reload
- **No build step** — all JS is plain ES2020+, loaded directly by Chrome. Don't introduce npm, TypeScript, or bundlers without discussing with the user
- **Vendor folder** — `vendor/leaflet/` is dead code from v0.1.0 and can be deleted; nothing references it anymore

## Extension version history
- **0.1.0** — new tab with Leaflet map, OSM geocoding via Nominatim (1.1s/req rate limit)
- **0.2.0** — side panel, Google Maps links, JSON-LD extraction, no geocoding

## How to load/test
1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" → select this repo folder
4. Navigate to a page with addresses or places
5. Click the Mapz icon in the toolbar
6. The side panel should open on the right

## Good test pages
- TripAdvisor attraction/restaurant lists
- Yelp search results
- Any page with Schema.org LocalBusiness JSON-LD
- Pages with plain street addresses in the body text
