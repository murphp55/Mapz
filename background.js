chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.id) {
    return;
  }

  // Must be called synchronously within the user gesture handler —
  // any await before this loses the gesture context and Chrome throws.
  chrome.sidePanel.open({ tabId: tab.id });

  try {
    let response;
    try {
      response = await chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_ADDRESSES" });
    } catch {
      // Tab was open before the extension loaded — inject the content script now.
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
      response = await chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_ADDRESSES" });
    }
    const addresses = Array.isArray(response?.addresses)
      ? response.addresses
      : [];
    const placeNames = Array.isArray(response?.placeNames)
      ? response.placeNames
      : [];
    const context = typeof response?.context === "string" ? response.context : "";

    await chrome.storage.session.set({
      pendingAddresses: addresses,
      pendingPlaces: placeNames,
      context,
      sourceUrl: tab.url || "",
      error: "",
      lastUpdated: Date.now()
    });
  } catch (err) {
    const message =
      chrome.runtime.lastError?.message ||
      (err && typeof err.message === "string" ? err.message : String(err));
    await chrome.storage.session.set({
      pendingAddresses: [],
      pendingPlaces: [],
      context: "",
      sourceUrl: tab.url || "",
      error: message,
      lastUpdated: Date.now()
    });
  }
});
