// Context Guard — content script
// Watches editable text areas on the page (works generically across X,
// Telegram Web, and most other sites since it targets contenteditable /
// textarea elements rather than any single platform's specific markup).

const DEFAULT_BACKEND_URL = "http://localhost:3000";
const DEBOUNCE_MS = 900;
const MIN_CHARS = 12; // don't bother analyzing very short fragments

let backendUrl = DEFAULT_BACKEND_URL;
let enabled = true;

chrome.storage?.sync?.get(["backendUrl", "outboundEnabled"], (data) => {
  if (data.backendUrl) backendUrl = data.backendUrl;
  if (typeof data.outboundEnabled === "boolean") enabled = data.outboundEnabled;
});

chrome.storage?.onChanged?.addListener((changes) => {
  if (changes.backendUrl) backendUrl = changes.backendUrl.newValue;
  if (changes.outboundEnabled) enabled = changes.outboundEnabled.newValue;
});

const debounceTimers = new WeakMap();
const activeTooltips = new WeakMap();

function getText(el) {
  if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") return el.value;
  return el.innerText || el.textContent || "";
}

function removeTooltip(el) {
  const tip = activeTooltips.get(el);
  if (tip) {
    tip.remove();
    activeTooltips.delete(el);
  }
}

function showTooltip(el, result) {
  removeTooltip(el);

  const tip = document.createElement("div");
  tip.className = "cg-tooltip";
  tip.innerHTML = `
    <div class="cg-tooltip-header">
      <span class="cg-tooltip-icon">💡</span>
      <span class="cg-tooltip-title">${escapeHtml(result.trope || "Worth a second look")}</span>
      <button class="cg-tooltip-close" aria-label="Dismiss">×</button>
    </div>
    <div class="cg-tooltip-body">${escapeHtml(result.explanation || "")}</div>
    <div class="cg-tooltip-footer">Not blocking you — just context. Post whenever you're ready.</div>
  `;

  document.body.appendChild(tip);
  positionTooltip(tip, el);

  tip.querySelector(".cg-tooltip-close").addEventListener("click", () => {
    tip.remove();
    activeTooltips.delete(el);
  });

  activeTooltips.set(el, tip);

  // Auto-dismiss after a while so it doesn't linger forever
  setTimeout(() => {
    if (activeTooltips.get(el) === tip) {
      tip.remove();
      activeTooltips.delete(el);
    }
  }, 15000);
}

function positionTooltip(tip, el) {
  const rect = el.getBoundingClientRect();
  tip.style.position = "absolute";
  tip.style.left = `${window.scrollX + rect.left}px`;
  tip.style.top = `${window.scrollY + rect.top - tip.offsetHeight - 8}px`;
  tip.style.zIndex = "999999";
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

async function analyze(text) {
  try {
    const res = await fetch(`${backendUrl}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn("Context Guard: analysis request failed", err);
    return null;
  }
}

function handleInput(el) {
  if (!enabled) return;

  clearTimeout(debounceTimers.get(el));
  const timer = setTimeout(async () => {
    const text = getText(el).trim();
    if (text.length < MIN_CHARS) {
      removeTooltip(el);
      return;
    }
    const result = await analyze(text);
    if (result && result.flagged && result.confidence >= 0.6) {
      showTooltip(el, result);
    } else {
      removeTooltip(el);
    }
  }, DEBOUNCE_MS);
  debounceTimers.set(el, timer);
}

function attachListeners(el) {
  if (el.dataset.cgAttached) return;
  el.dataset.cgAttached = "true";
  el.addEventListener("input", () => handleInput(el));
  el.addEventListener("blur", () => removeTooltip(el));
}

function scanForEditableFields(root = document) {
  const candidates = root.querySelectorAll(
    'textarea, [contenteditable="true"], [contenteditable=""]'
  );
  candidates.forEach(attachListeners);
}

// Initial scan
scanForEditableFields();

// Keep watching — X and Telegram Web are single-page apps that render
// compose boxes dynamically after initial load.
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    mutation.addedNodes.forEach((node) => {
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      if (
        node.matches?.('textarea, [contenteditable="true"], [contenteditable=""]')
      ) {
        attachListeners(node);
      }
      scanForEditableFields(node);
    });
  }
});

observer.observe(document.body, { childList: true, subtree: true });
