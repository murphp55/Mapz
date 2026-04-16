function googleMapsSearchUrl(query) {
  return (
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(query)
  );
}

function googleMapsDirectionsUrl(queries) {
  const stops = queries.map((q) => encodeURIComponent(q)).join("/");
  return "https://www.google.com/maps/dir/" + stops;
}

function buildQuery(entry, context) {
  if (entry.type === "address" || !context) return entry.label;
  return entry.label + ", " + context;
}

function renderSource(url) {
  const el = document.getElementById("source");
  if (!el) return;
  try {
    el.textContent = new URL(url).hostname;
  } catch {
    el.textContent = url || "";
  }
}

function showStatus(text) {
  const el = document.getElementById("status");
  if (!el) return;
  el.textContent = text;
  el.hidden = false;
}

function renderList(entries, context) {
  const list = document.getElementById("list");
  if (!list) return;

  list.innerHTML = "";

  if (entries.length === 0) {
    showStatus("No addresses or places found on this page.");
    return;
  }

  for (const entry of entries) {
    const query = buildQuery(entry, context);
    const url = googleMapsSearchUrl(query);

    const li = document.createElement("li");
    li.className = "list-item";

    const label = document.createElement("span");
    label.className = "item-label";
    label.textContent = entry.label;

    const badge = document.createElement("span");
    badge.className = "item-badge";
    badge.textContent = entry.type;

    const link = document.createElement("a");
    link.className = "item-link";
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.title = "Open in Google Maps";
    link.textContent = "↗";

    li.append(label, badge, link);
    list.appendChild(li);
  }
}

function setupViewAllButton(entries, context) {
  const toolbar = document.getElementById("toolbar");
  const btn = document.getElementById("btnAll");
  if (!toolbar || !btn || entries.length === 0) return;

  const queries = entries.map((e) => buildQuery(e, context));

  let url;
  if (queries.length === 1) {
    url = googleMapsSearchUrl(queries[0]);
  } else {
    // Directions URL supports up to ~10 waypoints reliably
    url = googleMapsDirectionsUrl(queries.slice(0, 10));
    if (queries.length > 10) {
      btn.textContent = "View first 10 on Google Maps";
    }
  }

  btn.href = url;
  toolbar.hidden = false;
}

async function main() {
  const {
    pendingAddresses = [],
    pendingPlaces = [],
    context = "",
    sourceUrl = "",
    error = ""
  } = await chrome.storage.session.get([
    "pendingAddresses",
    "pendingPlaces",
    "context",
    "sourceUrl",
    "error"
  ]);

  renderSource(sourceUrl);

  if (error) {
    showStatus("Could not read page: " + error);
    return;
  }

  const entries = [
    ...pendingAddresses.map((label) => ({ label, type: "address" })),
    ...pendingPlaces.map((label) => ({ label, type: "place" }))
  ];

  renderList(entries, context);
  setupViewAllButton(entries, context);
}

// Re-render when background pushes new data (panel already open)
chrome.storage.session.onChanged.addListener((changes) => {
  if ("lastUpdated" in changes) {
    main();
  }
});

document.addEventListener("DOMContentLoaded", () => {
  main().catch((err) => {
    showStatus("Error: " + (err.message || err));
  });
});
