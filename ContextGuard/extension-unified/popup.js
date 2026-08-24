// Tab switching
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`panel-${btn.dataset.tab}`).classList.add("active");
  });
});

// ---------- OUTBOUND (before you post) ----------
const outboundEls = {
  outboundEnabled: document.getElementById("outboundEnabled"),
  backendUrl: document.getElementById("backendUrl"),
};

chrome.storage.sync.get({ outboundEnabled: true, backendUrl: "http://localhost:3000" }, (stored) => {
  outboundEls.outboundEnabled.checked = stored.outboundEnabled;
  outboundEls.backendUrl.value = stored.backendUrl;
});

outboundEls.outboundEnabled.addEventListener("change", () => {
  chrome.storage.sync.set({ outboundEnabled: outboundEls.outboundEnabled.checked });
});

document.getElementById("saveBackend").addEventListener("click", () => {
  chrome.storage.sync.set({ backendUrl: outboundEls.backendUrl.value.trim() || "http://localhost:3000" });
});

// ---------- INBOUND (while you read) ----------
const INBOUND_SETTINGS_DEFAULT = {
  enabled: true,
  blockHateSpeech: true,
  blockIslamophobicContent: true,
  strictMode: false,
  aiAssist: false,
};

const inboundEls = {
  enabled: document.getElementById("enabled"),
  blockHateSpeech: document.getElementById("blockHateSpeech"),
  blockIslamophobicContent: document.getElementById("blockIslamophobicContent"),
  strictMode: document.getElementById("strictMode"),
  aiAssist: document.getElementById("aiAssist"),
  blockedCount: document.getElementById("blockedCount"),
  manualBlockedCount: document.getElementById("manualBlockedCount"),
};

chrome.storage.sync.get(INBOUND_SETTINGS_DEFAULT, (stored) => {
  inboundEls.enabled.checked = stored.enabled;
  inboundEls.blockHateSpeech.checked = stored.blockHateSpeech;
  inboundEls.blockIslamophobicContent.checked = stored.blockIslamophobicContent;
  inboundEls.strictMode.checked = stored.strictMode;
  inboundEls.aiAssist.checked = stored.aiAssist;
});

chrome.storage.local.get({ blockedCount: 0, manualBlockedCount: 0 }, (stored) => {
  inboundEls.blockedCount.textContent = stored.blockedCount;
  inboundEls.manualBlockedCount.textContent = stored.manualBlockedCount;
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local") {
    if (changes.blockedCount) inboundEls.blockedCount.textContent = changes.blockedCount.newValue;
    if (changes.manualBlockedCount) inboundEls.manualBlockedCount.textContent = changes.manualBlockedCount.newValue;
  }
});

function saveInbound() {
  chrome.storage.sync.set({
    enabled: inboundEls.enabled.checked,
    blockHateSpeech: inboundEls.blockHateSpeech.checked,
    blockIslamophobicContent: inboundEls.blockIslamophobicContent.checked,
    strictMode: inboundEls.strictMode.checked,
    aiAssist: inboundEls.aiAssist.checked,
  });
}

for (const key of ["enabled", "blockHateSpeech", "blockIslamophobicContent", "strictMode", "aiAssist"]) {
  inboundEls[key].addEventListener("change", saveInbound);
}
