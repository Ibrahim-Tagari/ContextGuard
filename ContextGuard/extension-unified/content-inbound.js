// content.js
// Runs on all sites (see manifest). Finds post/comment-like containers,
// tests their text against HS_PATTERNS, and blocks matches — both
// "hate_speech" and "islamophobic" types are blocked by default (see
// data/wordlist.js for the difference between them).
//
// Manual control, on top of auto-detection:
//   - Every blocked post has "Show post anyway" → "Hide again", a real
//     toggle, not one-way.
//   - Right-click any content → "Block this content" / "Unblock this
//     content" in the context menu, for content the detector missed or
//     got wrong.
// Both kinds of choice persist (chrome.storage.local, keyed by a hash of
// the post's text) so they survive reloads and reappearing content.

(() => {
  const SETTINGS_DEFAULT = {
    enabled: true,
    blockHateSpeech: true,
    blockIslamophobicContent: true,
    strictMode: false,
    aiAssist: false // opt-in: back up the regex with the shared Context Guard classifier
  };

  const CONFIDENCE_RANK = { low: 0, medium: 1, high: 2 };
  const MIN_CONFIDENCE_STANDARD = "medium";
  const PROCESSED_ATTR = "data-hsd-processed";
  const HASH_ATTR = "data-hsd-hash";

  // AI-assist is only run on hand-tuned SITE_SELECTOR matches (real posts),
  // never on the generic fallback scan — that can match hundreds of leaf
  // elements per page, and firing a network call for each would be both
  // slow and expensive. This cap is a second safety net on top of that.
  const AI_ASSIST_MAX_CALLS_PER_PAGE = 25;
  let aiAssistCallsUsed = 0;

  // Hand-tuned selectors for known sites — more precise post/comment
  // boundaries than the generic fallback can guess.
  const SITE_SELECTORS = [
    'article',
    '[data-testid="tweet"]',
    '[role="article"]',
    'div[data-ad-preview="message"]',
    'shreddit-comment',
    '.Comment',
    'ytd-comment-renderer',
    'li.comments-comment-item',
    'div.feed-shared-update-v2',
    'div[data-testid="post_message"]',
    // Chat apps — message bubbles, not feed posts
    'div[data-testid="msg-container"]',   // WhatsApp Web
    '.message-in .copyable-text',          // WhatsApp Web (incoming bubble text)
    '.message-out .copyable-text',         // WhatsApp Web (outgoing bubble text)
    '.Message .text-content',              // Telegram Web (K version)
    '.bubble .message',                    // Telegram Web (alt build)
  ];

  // Tags eligible for the generic, site-agnostic fallback scan — used on
  // sites with no hand-tuned selector above. This is a heuristic, not a
  // parser: it looks for elements whose OWN text (not a child's) reads
  // like a real chunk of content, and skips anything that itself contains
  // further block-level children (so we land on the innermost block).
  const GENERIC_BLOCK_TAGS = new Set(["P", "DIV", "SPAN", "LI", "TD", "ARTICLE"]);
  const GENERIC_MIN_WORDS = 3; // was 6 — chat messages are often shorter
  const GENERIC_MAX_WORDS = 400;

  let settings = { ...SETTINGS_DEFAULT };
  let overrides = {}; // hash -> { state: "block" | "allow", snippet, addedAt }
  let lastContextTarget = null;

  function loadSettings(cb) {
    if (!chrome?.storage?.sync) return cb();
    chrome.storage.sync.get(SETTINGS_DEFAULT, (stored) => {
      settings = { ...SETTINGS_DEFAULT, ...stored };
      cb();
    });
  }

  function loadOverrides(cb) {
    if (!chrome?.storage?.local) return cb && cb();
    chrome.storage.local.get({ overrides: {} }, (stored) => {
      overrides = stored.overrides || {};
      cb && cb();
    });
  }

  function saveOverride(hash, state, snippet) {
    overrides[hash] = { state, snippet: snippet.slice(0, 140), addedAt: Date.now() };
    chrome.storage.local.set({ overrides });
  }

  // --- text hashing (djb2), for keying persisted overrides ---
  function normalizeText(text) {
    return text.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 500);
  }
  function hashText(text) {
    let hash = 5381;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) + hash) + text.charCodeAt(i);
    }
    return (hash >>> 0).toString(36);
  }

  function meetsConfidenceFloor(entry) {
    const floor = settings.strictMode ? "low" : MIN_CONFIDENCE_STANDARD;
    return CONFIDENCE_RANK[entry.confidence] >= CONFIDENCE_RANK[floor];
  }

  function findMatch(text) {
    if (!text || text.trim().length === 0) return null;
    for (const guard of HS_CONTEXT_GUARDS) {
      if (guard.test(text)) return null;
    }
    for (const entry of HS_PATTERNS) {
      if (!meetsConfidenceFloor(entry)) continue;
      if (entry.pattern.test(text)) return entry;
    }
    return null;
  }

  function typeIsEnabled(type) {
    if (type === "hate_speech") return settings.blockHateSpeech;
    if (type === "islamophobic") return settings.blockIslamophobicContent;
    return true; // manual overrides always apply
  }

  function incrementCounter(kind) {
    if (!chrome?.storage?.local) return;
    const key = kind === "manual" ? "manualBlockedCount" : "blockedCount";
    chrome.storage.local.get({ [key]: 0 }, (stored) => {
      chrome.storage.local.set({ [key]: stored[key] + 1 });
    });
  }

  function buildCard(entry) {
    const reply = HS_REPLIES[entry.category] || HS_REPLIES.default;
    const card = document.createElement("div");
    card.className = "hsd-card";

    // Collapsed by default: just a compact badge naming the reason. The
    // full explanation is a click away, in a dropdown — it doesn't need to
    // permanently occupy space on every blocked post, and stays confined to
    // exactly the blurred area instead of ballooning the card past it.
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "hsd-card-toggle";
    toggle.setAttribute("aria-expanded", "false");

    const icon = document.createElement("span");
    icon.className = "hsd-card-icon";
    icon.textContent = "🛡";
    icon.setAttribute("aria-hidden", "true");

    const label = document.createElement("span");
    label.className = "hsd-card-label";
    label.textContent = reply.label + (entry.aiAssisted ? " · AI-assisted" : "");

    const chevron = document.createElement("span");
    chevron.className = "hsd-card-chevron";
    chevron.textContent = "▾";
    chevron.setAttribute("aria-hidden", "true");

    toggle.appendChild(icon);
    toggle.appendChild(label);
    toggle.appendChild(chevron);

    const details = document.createElement("div");
    details.className = "hsd-card-details";
    details.hidden = true;

    const msg = document.createElement("div");
    msg.className = "hsd-card-message";
    msg.textContent = reply.message;
    details.appendChild(msg);

    card.appendChild(toggle);
    card.appendChild(details);
    return { card, toggle, details };
  }

  // Applies (or re-applies) the blur+card treatment. `hash` is stored on
  // the element so a later right-click can find it again for unblocking.
  function applyBlockTreatment(postEl, entry, hash) {
    postEl.setAttribute(HASH_ATTR, hash);

    // Already blocked (e.g. re-blocking after a manual unblock) — just
    // reset the blur rather than double-wrapping. Found via "hsd-inner",
    // a permanent marker class, NOT "hsd-blurred" — that one gets removed
    // on unblock, so relying on it here would lose track of the wrapper.
    if (postEl.classList.contains("hsd-wrapper")) {
      const inner = postEl.querySelector(":scope > .hsd-inner");
      const oldOverlay = postEl.querySelector(":scope > .hsd-overlay");
      if (oldOverlay) oldOverlay.remove();
      if (inner) inner.classList.add("hsd-blurred");
      postEl.appendChild(buildOverlay(postEl, entry, hash));
      return;
    }

    postEl.classList.add("hsd-wrapper");

    // Absolutely-positioned children (the overlay) only size correctly
    // against a block-level containing block. Chat-bubble selectors above
    // (e.g. WhatsApp/Telegram) often match inline <span>s — position:relative
    // on an inline element doesn't reliably size an inset:0 child, which is
    // what caused the overlay to render in the wrong spot / overlap
    // neighboring messages. Only intervene when actually needed, so we don't
    // disturb sites where the matched element is already block/flex/grid.
    const computedDisplay = getComputedStyle(postEl).display;
    if (computedDisplay === "inline" || computedDisplay === "contents") {
      postEl.style.display = "block";
    }

    const inner = document.createElement("div");
    inner.className = "hsd-inner hsd-blurred";
    while (postEl.firstChild) inner.appendChild(postEl.firstChild);
    postEl.appendChild(inner);

    // Baseline height of the actual blurred content, captured once before
    // we ever force a taller min-height for the card. ensureFitsCard uses
    // this as the floor so the post can shrink back down to its real size
    // once the dropdown is collapsed again, instead of staying artificially
    // tall forever.
    inner.dataset.hsdNaturalHeight = String(inner.scrollHeight);

    postEl.appendChild(buildOverlay(postEl, entry, hash));

    incrementCounter(entry.type === "manual" || entry.category === "manual" ? "manual" : "auto");
  }

  function buildOverlay(postEl, entry, hash) {
    const overlay = document.createElement("div");
    overlay.className = "hsd-overlay";
    const { card, toggle, details } = buildCard(entry);

    const revealBtn = document.createElement("button");
    revealBtn.className = "hsd-reveal-btn";
    revealBtn.textContent = "Show post anyway";
    revealBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      unblockContainer(postEl, hash);
    });
    details.appendChild(revealBtn);

    const sync = () => ensureFitsCard(postEl, overlay, card);

    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const expanded = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!expanded));
      details.hidden = expanded;
      card.classList.toggle("hsd-card-expanded", !expanded);
      // Let the new (collapsed or expanded) layout settle before
      // re-measuring, so the post grows/shrinks to match.
      requestAnimationFrame(sync);
    });

    overlay.appendChild(card);

    // The card's natural height (icon + label, and — once expanded — the
    // full message + button) can be taller than a short post's collapsed
    // blurred content, e.g. a one-line tweet or chat bubble. Since the
    // overlay doesn't clip itself, an oversized card would spill out past
    // the bottom of its own post and visually overlap whatever comes next
    // in the feed. Force the post to grow (via the inner wrapper) to at
    // least fit the card, and keep it in sync as the card's size changes
    // (dropdown toggled, font load, text reflow, etc).
    ensureFitsCard(postEl, overlay, card);

    return overlay;
  }

  function ensureFitsCard(postEl, overlay, card) {
    const inner = postEl.querySelector(":scope > .hsd-inner");
    if (!inner || !overlay.isConnected) return;
    const OVERLAY_PADDING = 16; // matches .hsd-overlay's 8px padding, both sides

    const sync = () => {
      if (!overlay.isConnected) return;
      const natural = parseFloat(inner.dataset.hsdNaturalHeight || "0") || inner.scrollHeight;
      const neededForCard = card.offsetHeight + OVERLAY_PADDING;
      const target = Math.max(natural, neededForCard);
      inner.style.minHeight = target + "px";
    };

    sync();

    if (window.ResizeObserver) {
      const ro = new ResizeObserver(sync);
      ro.observe(card);
      const stopWatching = new MutationObserver(() => {
        if (!postEl.contains(overlay)) {
          ro.disconnect();
          stopWatching.disconnect();
        }
      });
      stopWatching.observe(postEl, { childList: true });
    } else {
      requestAnimationFrame(sync);
    }
  }

  function unblockContainer(postEl, hash) {
    const inner = postEl.querySelector(":scope > .hsd-inner");
    const overlay = postEl.querySelector(":scope > .hsd-overlay");
    if (inner) {
      inner.classList.remove("hsd-blurred");
      inner.style.minHeight = ""; // release the height we forced to fit the card
    }
    if (overlay) overlay.remove();
    saveOverride(hash, "allow", inner ? inner.innerText || "" : "");
    addAllowedPill(postEl, hash);
  }

  // Persistent "Allowed by you" indicator with an inline undo, shown after
  // a manual unblock — the choice is genuinely two-way, not a one-time reveal.
  function addAllowedPill(postEl, hash) {
    const old = postEl.querySelector(":scope > .hsd-allowed-pill");
    if (old) old.remove();

    const pill = document.createElement("div");
    pill.className = "hsd-allowed-pill";
    const label = document.createElement("span");
    label.textContent = "✓ Allowed by you";
    const undo = document.createElement("button");
    undo.className = "hsd-undo-link";
    undo.textContent = "Hide again";
    undo.addEventListener("click", (e) => {
      e.stopPropagation();
      const text = postEl.innerText || postEl.textContent || "";
      const match = findMatch(text) || { category: "manual", type: "manual" };
      saveOverride(hash, "block", text);
      pill.remove();
      applyBlockTreatment(postEl, match, hash);
    });
    pill.appendChild(label);
    pill.appendChild(undo);
    postEl.appendChild(pill);
  }

  // Small "Block" button that appears on hover over any scanned-but-clean
  // post, so manual blocking doesn't require knowing about the right-click
  // menu. Skipped on posts already carrying a block/allow treatment.
  function addManualBlockButton(postEl, hash) {
    if (postEl.querySelector(":scope > .hsd-corner-btn")) return;
    const btn = document.createElement("button");
    btn.className = "hsd-corner-btn hsd-corner-btn-hover";
    btn.textContent = "Block";
    btn.title = "Block this content";
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const text = postEl.innerText || postEl.textContent || "";
      const match = findMatch(text) || { category: "manual", type: "manual" };
      saveOverride(hash, "block", text);
      btn.remove();
      postEl.classList.remove("hsd-scanned-clean");
      applyBlockTreatment(postEl, match, hash);
    });
    // Own marker class, deliberately NOT "hsd-wrapper" — that class also
    // signals "already blurred+overlaid" to applyBlockTreatment, and a
    // clean post with just a hover button hasn't been wrapped yet.
    postEl.classList.add("hsd-scanned-clean");
    postEl.appendChild(btn);
  }

  // --- container discovery -------------------------------------------------

  // Counts words in an element's rendered text. Deliberately uses
  // innerText (which includes text nested inside inline elements like
  // <span>) rather than only the element's own direct text nodes — chat
  // apps (WhatsApp Web, Telegram Web, Instagram DMs) almost universally
  // wrap message text in one or more nested <span>s for styling and
  // read-receipt markup. Counting only direct text nodes made every
  // message on those apps look empty and get silently skipped. This is
  // still safe against double-counting a whole feed wrapper because this
  // is only called on nodes that already passed the "no block-level
  // children" check in collectGenericLeafBlocks — anything left nested
  // inside is inline markup, not another content chunk.
  function getVisibleWordCount(el) {
    const t = el.innerText || el.textContent || "";
    return t.trim().split(/\s+/).filter(Boolean).length;
  }

  function collectSiteSelectorMatches(root) {
    const found = new Set();
    for (const sel of SITE_SELECTORS) {
      if (root.matches?.(sel)) found.add(root);
      root.querySelectorAll?.(sel).forEach((el) => found.add(el));
    }
    return found;
  }

  // Generic fallback: walk the tree, keep block-level elements that carry
  // their own substantial text and have no block-level children (so we
  // land on the innermost real "chunk" rather than a whole feed wrapper).
  function collectGenericLeafBlocks(root, alreadyFound) {
    const results = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
      acceptNode(node) {
        if (!GENERIC_BLOCK_TAGS.has(node.tagName)) return NodeFilter.FILTER_SKIP;
        if (alreadyFound.has(node)) return NodeFilter.FILTER_SKIP;
        if (node.closest(`[${PROCESSED_ATTR}]`)) return NodeFilter.FILTER_SKIP;
        if (node.querySelector("p,div,li,td,article")) return NodeFilter.FILTER_SKIP;
        const wc = getVisibleWordCount(node);
        if (wc < GENERIC_MIN_WORDS || wc > GENERIC_MAX_WORDS) return NodeFilter.FILTER_SKIP;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let n;
    while ((n = walker.nextNode())) results.push(n);
    return results;
  }

  // Used for right-click "block this content" on something the scanner
  // never touched — walk up from the clicked node to the nearest
  // reasonable container.
  function findContainerFromNode(node) {
    let el = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    while (el && el !== document.body && el !== document.documentElement) {
      const existingHash = el.getAttribute?.(HASH_ATTR);
      if (existingHash) return el;
      for (const sel of SITE_SELECTORS) {
        if (el.matches?.(sel)) return el;
      }
      const text = el.innerText || "";
      const wc = text.trim().split(/\s+/).filter(Boolean).length;
      if (wc >= 3 && wc <= GENERIC_MAX_WORDS && GENERIC_BLOCK_TAGS.has(el.tagName)) {
        return el;
      }
      el = el.parentElement;
    }
    return node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  }

  // --- main scan -------------------------------------------------------

  function processContainer(el, aiEligible) {
    if (!el || el.hasAttribute(PROCESSED_ATTR)) return;
    const text = el.innerText || el.textContent || "";
    if (text.trim().length < 3) return;

    el.setAttribute(PROCESSED_ATTR, "1");
    const hash = hashText(normalizeText(text));
    el.setAttribute(HASH_ATTR, hash);

    const override = overrides[hash];
    if (override?.state === "allow") return; // user explicitly unblocked this before

    if (override?.state === "block") {
      const match = findMatch(text) || { category: "manual", type: "manual" };
      applyBlockTreatment(el, match, hash);
      return;
    }

    const match = findMatch(text);
    if (!match) {
      addManualBlockButton(el, hash);
      // Regex found nothing — optionally back it up with the shared AI
      // classifier, but only on curated site-selector matches and only
      // up to a per-page call budget (see AI_ASSIST_MAX_CALLS_PER_PAGE).
      if (settings.aiAssist && aiEligible && aiAssistCallsUsed < AI_ASSIST_MAX_CALLS_PER_PAGE) {
        aiAssistCallsUsed++;
        requestAiAssist(text, el, hash);
      }
      return;
    }
    if (!typeIsEnabled(match.type)) return;
    applyBlockTreatment(el, match, hash);
  }

  // Asks the background service worker to classify text the regex missed,
  // using the same Context Guard backend the outbound (before-you-post)
  // module already calls. Only acts if the element is still unprocessed
  // by the time the response comes back (page may have changed by then).
  function requestAiAssist(text, el, hash) {
    chrome.runtime.sendMessage({ type: "CLASSIFY", text }, (response) => {
      if (!response || !response.flagged) return;
      if (response.confidence < 0.6) return;
      if (!el.isConnected) return; // element removed from DOM since we asked
      const overrideNow = overrides[hash];
      if (overrideNow) return; // user made a manual choice while we were waiting
      const corner = el.querySelector(":scope > .hsd-corner-btn");
      if (corner) corner.remove();
      el.classList.remove("hsd-scanned-clean");
      const match = { type: "islamophobic", category: "generalization", confidence: "medium", aiAssisted: true };
      if (!typeIsEnabled(match.type)) return;
      applyBlockTreatment(el, match, hash);
    });
  }

  function scanNode(root) {
    if (!settings.enabled || !(root instanceof Element)) return;

    const siteMatches = collectSiteSelectorMatches(root);
    siteMatches.forEach((el) => processContainer(el, true));

    const genericMatches = collectGenericLeafBlocks(root, siteMatches);
    genericMatches.forEach((el) => processContainer(el, false));
  }

  function startObserving() {
    scanNode(document.body);

    const observer = new MutationObserver((mutations) => {
      const nodesToScan = new Set();
      for (const m of mutations) {
        m.addedNodes.forEach((n) => {
          if (n instanceof Element) nodesToScan.add(n);
        });
      }
      if (nodesToScan.size === 0) return;
      requestAnimationFrame(() => nodesToScan.forEach(scanNode));
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  // --- context menu bridge (manual block/unblock of arbitrary content) ---

  document.addEventListener("contextmenu", (e) => {
    lastContextTarget = e.target;
  }, true);

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "HSD_BLOCK_SELECTION") {
      const container = findContainerFromNode(lastContextTarget);
      if (!container) return;
      const text = container.innerText || container.textContent || "";
      if (text.trim().length < 3) return;
      const hash = hashText(normalizeText(text));
      container.setAttribute(PROCESSED_ATTR, "1");
      const match = findMatch(text) || { category: "manual", type: "manual" };
      saveOverride(hash, "block", text);
      applyBlockTreatment(container, match, hash);
    }

    if (message?.type === "HSD_UNBLOCK_SELECTION") {
      const blockedAncestor = lastContextTarget?.closest?.(".hsd-wrapper");
      const container = blockedAncestor || findContainerFromNode(lastContextTarget);
      if (!container) return;
      const hash = container.getAttribute(HASH_ATTR) ||
        hashText(normalizeText(container.innerText || container.textContent || ""));
      unblockContainer(container, hash);
    }
  });

  loadSettings(() => loadOverrides(startObserving));

  if (chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "sync") {
        for (const key of Object.keys(changes)) settings[key] = changes[key].newValue;
      }
      if (area === "local" && changes.overrides) {
        overrides = changes.overrides.newValue || {};
      }
    });
  }
})();
