// Context Guard — inbound scanner diagnostic
// Paste this into DevTools Console (F12 → Console tab) on the page where
// posts aren't getting blurred, then paste the full output back.

(function () {
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
    'div[data-testid="msg-container"]',
    '.message-in .copyable-text',
    '.message-out .copyable-text',
    '.Message .text-content',
    '.bubble .message',
  ];

  console.log("=== Context Guard diagnostic ===");
  console.log("URL:", location.href);
  console.log("");

  let anyMatch = false;
  SITE_SELECTORS.forEach((sel) => {
    let els;
    try {
      els = document.querySelectorAll(sel);
    } catch (e) {
      console.log(`"${sel}" -> selector error: ${e.message}`);
      return;
    }
    if (els.length > 0) {
      anyMatch = true;
      console.log(`"${sel}" -> ${els.length} match(es)`);
      const sample = els[0];
      const text = (sample.innerText || sample.textContent || "").trim();
      console.log(`   sample text (first 80 chars): "${text.slice(0, 80)}"`);
      console.log(`   sample text length: ${text.length} chars`);
    }
  });

  if (!anyMatch) {
    console.log("NO SITE_SELECTOR MATCHES FOUND AT ALL on this page.");
  }

  console.log("");
  console.log("--- Extension marker check ---");
  const processed = document.querySelectorAll("[data-hsd-processed]").length;
  const wrapped = document.querySelectorAll(".hsd-wrapper").length;
  const cleanButtons = document.querySelectorAll(".hsd-corner-btn").length;
  console.log("Elements marked processed by the extension:", processed);
  console.log("Elements wrapped/blurred:", wrapped);
  console.log("Elements with a hover 'Block' button (scanned, found clean):", cleanButtons);

  if (processed === 0) {
    console.log("");
    console.log("⚠ Zero elements processed at all — the content script may not be running on this page. Check chrome://extensions for errors, and confirm the extension is enabled.");
  } else if (wrapped === 0 && cleanButtons > 0) {
    console.log("");
    console.log("⚠ Elements ARE being scanned, but none matched the wordlist. If you typed a phrase that should match, the container boundary may be wrong — try right-click → 'Block this content' directly on the post as a manual test.");
  }

  console.log("=== end diagnostic ===");
})();
