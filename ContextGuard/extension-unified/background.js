// background.js
// MV3 service worker for the unified Context Guard extension.
//
// Two responsibilities:
//   1. Seed defaults for both modules on install, and wire the right-click
//      context menu used by the inbound (Shield) module's manual block/
//      unblock controls.
//   2. Answer CLASSIFY messages from the inbound module by calling the
//      same backend the outbound (nudge-before-you-post) module already
//      uses — this is what lets Shield catch tropes its regex list misses,
//      without maintaining two separate classifiers.

const INBOUND_SETTINGS_DEFAULT = {
  enabled: true,
  blockHateSpeech: true,
  blockIslamophobicContent: true,
  strictMode: false,
  aiAssist: false
};

const OUTBOUND_SETTINGS_DEFAULT = {
  outboundEnabled: true,
  backendUrl: "http://localhost:3000"
};

const COUNTERS_DEFAULT = {
  blockedCount: 0,
  manualBlockedCount: 0
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get({ ...INBOUND_SETTINGS_DEFAULT, ...OUTBOUND_SETTINGS_DEFAULT }, (stored) => {
    chrome.storage.sync.set({ ...INBOUND_SETTINGS_DEFAULT, ...OUTBOUND_SETTINGS_DEFAULT, ...stored });
  });
  chrome.storage.local.get({ ...COUNTERS_DEFAULT, overrides: {} }, (stored) => {
    chrome.storage.local.set({ ...COUNTERS_DEFAULT, ...stored, overrides: stored.overrides || {} });
  });

  chrome.contextMenus.create({
    id: "hsd-block",
    title: "Block this content (Context Guard)",
    contexts: ["all"]
  });
  chrome.contextMenus.create({
    id: "hsd-unblock",
    title: "Unblock this content (Context Guard)",
    contexts: ["all"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;
  if (info.menuItemId === "hsd-block") {
    chrome.tabs.sendMessage(tab.id, { type: "HSD_BLOCK_SELECTION" });
  }
  if (info.menuItemId === "hsd-unblock") {
    chrome.tabs.sendMessage(tab.id, { type: "HSD_UNBLOCK_SELECTION" });
  }
});

// Answers CLASSIFY requests from content-inbound.js's AI-assist path.
// Runs in the service worker (not the page) so the backend URL setting is
// read from storage once here rather than duplicated in every content
// script instance.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "CLASSIFY") return false;

  chrome.storage.sync.get({ backendUrl: OUTBOUND_SETTINGS_DEFAULT.backendUrl }, async (stored) => {
    try {
      const res = await fetch(`${stored.backendUrl}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message.text }),
      });
      if (!res.ok) {
        sendResponse({ flagged: false, error: `Backend returned ${res.status}` });
        return;
      }
      const result = await res.json();
      sendResponse(result);
    } catch (err) {
      sendResponse({ flagged: false, error: String(err) });
    }
  });

  return true; // keep the message channel open for the async response above
});
