const ADDRESS_SUFFIXES =
  "(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Circle|Cir|Way|Place|Pl|Terrace|Ter|Parkway|Pkwy|Highway|Hwy|Loop|Trail|Trl|Square|Sq|Plaza|Plz|Center|Ctr|Point|Pt|Crescent|Cres|Hill|Hl)";

const STATE_ABBR =
  "(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC|PR|VI|GU|AS|MP)";

const STREET_PATTERN =
  `\\b\\d{1,6}\\s+(?:[A-Za-z0-9'.-]+\\s+){0,6}(?:N|S|E|W|NE|NW|SE|SW)?\\s*${ADDRESS_SUFFIXES}\\.?` +
  `(?:\\s+(?:Apt|Apartment|Suite|Ste|Unit|#)\\s*[A-Za-z0-9-]+)?\\b`;

const STREET_REGEX = new RegExp(STREET_PATTERN, "ig");
const STREET_REGEX_SINGLE = new RegExp(STREET_PATTERN, "i");

const CITY_STATE_ZIP_REGEX = new RegExp(
  `\\b[A-Za-z .'-]+,\\s*${STATE_ABBR}\\s*\\d{5}(?:-\\d{4})?\\b`,
  "i"
);

const CITY_STATE_ZIP_INLINE_REGEX = new RegExp(
  `,\\s*[A-Za-z .'-]+,\\s*${STATE_ABBR}\\s*\\d{5}(?:-\\d{4})?\\b`,
  "i"
);

const PLACE_TYPES_RE =
  /LocalBusiness|Restaurant|Hotel|Store|CafeOrCoffeeShop|Bar|Museum|Park|TouristAttraction|LandmarksOrHistoricalBuildings|FoodEstablishment|PointOfInterest|Place|LodgingBusiness|Winery|Brewery|NightClub|SportsClub|Library|Aquarium|Zoo/i;

const NOISE_WORDS = [
  "things to do",
  "learn more",
  "see all",
  "read more",
  "reviews",
  "tickets",
  "book now",
  "sign in",
  "log in",
  "sign up",
  "get directions",
  "view map",
  "show map",
  "share",
  "save",
  "print",
  "manage ",
  "cookie",
  "privacy",
  "consent",
  "preferences",
  "newsletter",
  "subscribe",
  "advertisement",
  "trending",
  "in this section"
];

function normalizeAddress(text) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizePlace(text) {
  return text.replace(/\s+/g, " ").trim();
}

function isLikelyPlaceName(text) {
  if (!text || text.length < 3 || text.length > 60) {
    return false;
  }
  if (STREET_REGEX_SINGLE.test(text)) {
    return false;
  }
  // All-uppercase short strings are section headers (e.g. "IN THIS SECTION", "TRENDING")
  if (text === text.toUpperCase() && /[A-Z]/.test(text)) {
    return false;
  }
  // Strings with a year are article titles or event listings, not place names
  if (/\b20\d{2}\b/.test(text)) {
    return false;
  }
  // Colons signal article titles ("A Ranking: ...", "Guide: ...")
  if (text.includes(":")) {
    return false;
  }
  const lower = text.toLowerCase();
  return !NOISE_WORDS.some((word) => lower === word || lower.includes(word));
}

// --- JSON-LD extraction (highest priority) ---

function extractFromJsonLd() {
  const addresses = [];
  const places = [];
  const seenAddresses = new Set();
  const seenPlaces = new Set();

  function addAddress(raw) {
    if (!raw || typeof raw !== "string") return;
    const str = raw.replace(/\s+/g, " ").trim();
    const key = str.toLowerCase();
    if (str && !seenAddresses.has(key)) {
      seenAddresses.add(key);
      addresses.push(str);
    }
  }

  function addPlace(raw) {
    if (!raw || typeof raw !== "string") return;
    const str = raw.replace(/\s+/g, " ").trim();
    if (isLikelyPlaceName(str) && !seenPlaces.has(str.toLowerCase())) {
      seenPlaces.add(str.toLowerCase());
      places.push(str);
    }
  }

  function processNode(node) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(processNode);
      return;
    }

    const type = node["@type"];
    const types = Array.isArray(type) ? type : type ? [type] : [];
    const isPlace = types.some((t) => PLACE_TYPES_RE.test(t));

    if (isPlace) {
      addPlace(node.name);

      if (node.address) {
        if (typeof node.address === "string") {
          addAddress(node.address);
        } else if (typeof node.address === "object" && !Array.isArray(node.address)) {
          const a = node.address;
          const parts = [
            a.streetAddress,
            a.addressLocality,
            a.addressRegion,
            a.postalCode
          ].filter((p) => p && typeof p === "string");
          if (parts.length > 0) addAddress(parts.join(", "));
        }
      }
    }

    for (const key of Object.keys(node)) {
      if (key === "@context" || key === "image" || key === "logo") continue;
      if (typeof node[key] === "object") processNode(node[key]);
    }
  }

  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      processNode(JSON.parse(script.textContent));
    } catch {
      // ignore malformed JSON-LD
    }
  }

  return { addresses, places };
}

// --- Regex address extraction (fallback) ---

function extractAddressesFromText(text) {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const results = [];
  const seen = new Set();

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const matches = [...line.matchAll(STREET_REGEX)];
    if (!matches.length) {
      continue;
    }

    for (const match of matches) {
      let candidate = match[0];
      const remaining = line.slice(match.index + match[0].length);
      if (CITY_STATE_ZIP_INLINE_REGEX.test(remaining)) {
        const inline = remaining.match(CITY_STATE_ZIP_INLINE_REGEX);
        candidate = `${candidate}${inline[0]}`;
      } else {
        const nextLine = lines[i + 1];
        if (nextLine && CITY_STATE_ZIP_REGEX.test(nextLine)) {
          candidate = `${candidate}, ${nextLine}`;
        }
      }

      if (candidate.length > 160) {
        candidate = candidate.slice(0, 160);
      }

      const normalized = normalizeAddress(candidate);
      if (!seen.has(normalized)) {
        seen.add(normalized);
        results.push(candidate);
      }
    }
  }

  return results;
}

// --- DOM-based place name extraction (fallback) ---

function extractPlaceNamesFromDom() {
  const candidates = [];
  const seen = new Set();

  const addCandidate = (raw) => {
    const text = normalizePlace(raw || "");
    if (isLikelyPlaceName(text) && !seen.has(text.toLowerCase())) {
      seen.add(text.toLowerCase());
      candidates.push(text);
    }
  };

  // TripAdvisor-style attraction links
  for (const anchor of document.querySelectorAll("a[href]")) {
    const href = anchor.getAttribute("href") || "";
    if (
      href.includes("Attraction_Review") ||
      href.includes("AttractionProductReview") ||
      href.includes("Attraction_Products")
    ) {
      addCandidate(anchor.textContent || "");
    }
  }

  // Microdata Schema.org
  for (const node of document.querySelectorAll(
    "[itemtype*='LocalBusiness'], [itemtype*='Restaurant'], [itemtype*='Store'], [itemtype*='FoodEstablishment'], [itemtype*='PointOfInterest']"
  )) {
    const name =
      node.querySelector("[itemprop='name']")?.textContent ||
      node.getAttribute("aria-label") ||
      node.getAttribute("title") ||
      "";
    addCandidate(name);
  }

  // h3 headings as last resort — h2 is too often used for section/nav labels
  if (candidates.length < 3) {
    for (const heading of document.querySelectorAll("h3")) {
      addCandidate(heading.textContent || "");
    }
  }

  return candidates;
}

// --- Location context inference ---

function inferLocationContext() {
  const url = window.location.href || "";
  const slugMatch = url.match(/-([A-Za-z]+)_([A-Za-z]+)\.html(?:\?|#|$)/);
  if (slugMatch) {
    return `${slugMatch[1].replace(/_/g, " ")}, ${slugMatch[2].replace(/_/g, " ")}`;
  }

  const title = document.title || "";
  const titleMatch = title.match(/in\s+([^|\-]+)(?:\s*[\-|\|]|$)/i);
  if (titleMatch) {
    return titleMatch[1].trim();
  }

  return "";
}

// --- Main extraction ---

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "EXTRACT_ADDRESSES") {
    return false;
  }

  const jsonLd = extractFromJsonLd();

  // Use JSON-LD addresses if found, otherwise fall back to regex
  let addresses = jsonLd.addresses;
  if (addresses.length < 3) {
    const text = document.body ? document.body.innerText || "" : "";
    const regexAddresses = extractAddressesFromText(text);
    const seen = new Set(addresses.map((a) => a.toLowerCase()));
    for (const a of regexAddresses) {
      if (!seen.has(a.toLowerCase())) {
        seen.add(a.toLowerCase());
        addresses.push(a);
      }
    }
  }
  addresses = addresses.slice(0, 200);

  // Use JSON-LD places if found, otherwise fall back to DOM extraction
  let placeNames = jsonLd.places;
  if (placeNames.length < 3) {
    const domPlaces = extractPlaceNamesFromDom();
    const seen = new Set(placeNames.map((p) => p.toLowerCase()));
    for (const p of domPlaces) {
      if (!seen.has(p.toLowerCase())) {
        seen.add(p.toLowerCase());
        placeNames.push(p);
      }
    }
  }
  placeNames = placeNames.slice(0, 200);

  const context = inferLocationContext();
  sendResponse({ addresses, placeNames, context });
  return true;
});
