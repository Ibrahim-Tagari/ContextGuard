# Context Guard — Unified Extension (v2.0.0)

This merges two previously separate projects into one extension with two
modules that share a single AI backend:

- **Before you post** (was "Context Guard") — nudges you with context when
  your own draft echoes an Islamophobic trope. Never blocks, never deletes.
- **While you read** (was "Islamophobia Shield") — blurs anti-Muslim hate
  speech and Islamophobic content in what you're *reading*, with a one-click
  "Show post anyway" toggle. Backed by a local wordlist, optionally topped
  up by the same AI classifier the "before you post" module uses.

## A note on the philosophy, honestly

The original Context Guard pitch was built around "nudge, don't block" —
and positioned itself explicitly against tools that block content. Shield
blocks by default. That's a real tension, not a coincidence to smooth over.

Here's how this merge reconciles it: **both modules leave the choice with
the person, at every step.** The outbound module never touches what you
post. The inbound module blurs by default, but every blur has a visible,
one-click "Show post anyway," and every choice — including reversing a
block — is remembered and fully undoable from the popup or the right-click
menu. Nothing is ever deleted on either side. The difference is which
direction the context flows: outbound helps you avoid posting a myth
unknowingly; inbound helps you avoid absorbing one unknowingly. Same
principle, applied to both sides of the screen.

If that framing doesn't sit right for your use case, the popup lets you
turn either module off independently — you can run this as nudge-only,
shield-only, or both.

## What changed in the merge

- **One manifest**, two sets of content scripts:
  - Outbound module still only runs on X, Telegram Web, and Instagram —
    the sites you'd actually post from.
  - Inbound module still runs on all sites (`http://*/*`, `https://*/*`,
    `file:///*`) — that broad reach is the entire point of Shield, so it's
    preserved as-is. You'll see Chrome's standard "read and change data on
    every site you visit" warning on install because of this.
- **One popup**, tabbed between "Before you post" and "While you read,"
  instead of two separate extension icons.
- **One options page** (Shield's original) for the manual-override manager
  and permissions explanation.
- **One background service worker**, combining Shield's context-menu logic
  with a real implementation of the `CLASSIFY` message handler that used to
  be a stub — it now calls the shared backend's `/analyze` endpoint.
- **New: AI-assist (beta)**, off by default. When enabled, if the inbound
  module's regex wordlist finds nothing on a *curated* post (a hand-tuned
  `SITE_SELECTORS` match — never the broad generic fallback, to control
  cost and speed), it asks the same backend used for outbound nudges to
  double-check. This is the direct fix for the limitation Shield's own
  README flagged: *"Detection is regex-based, not a trained classifier...
  will miss coded language."* Capped at 25 AI calls per page load.
- **Storage key fix**: both original projects independently used a
  `"enabled"` key in `chrome.storage.sync`. Left alone, merging them would
  have silently tied the two modules' on/off switches together. The
  outbound module's key is now `outboundEnabled`; the inbound module kept
  `enabled`. If you're diffing against the original two projects, this is
  the one behavioral fix beyond straightforward merging.

## Setup

1. Get the backend running first (see `../backend/README` or the main
   project README) — both modules depend on it for anything AI-related.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select this
   `extension-unified` folder.
3. Accept the all-sites permission prompt (required for the inbound
   module — see above).
4. Click the extension icon. Under **Before you post**, confirm the
   backend URL and toggle it on. Under **While you read**, toggle
   categories and AI-assist as you like.
5. Test inbound detection without a live account: open `test-page.html` in
   the browser (enable "Allow access to file URLs" for this extension in
   `chrome://extensions` first).
6. Test outbound nudges on x.com, web.telegram.org, or instagram.com as
   before.

## Fixed since the first merge: text detection wasn't working on chat apps

The inbound module's generic fallback scanner counted words using only an
element's *direct* text nodes, ignoring text nested inside child `<span>`
tags. WhatsApp Web, Telegram Web, and Instagram all wrap message text in
nested spans for styling — so every message's word count came back as 0,
and every message was silently skipped, regardless of content. Fixed to
count visible text (`innerText`) instead. Also added hand-tuned selectors
for WhatsApp Web and Telegram Web message bubbles, and lowered the generic
scanner's minimum word count from 6 to 3, since chat messages are often
shorter than typical social posts.

## Scope decision: text only, not images or video frames

Real-time image/video content analysis (hate symbols in memes, frame-by-
frame video scanning) would require sending media to a cloud vision model
per item — a meaningfully bigger privacy footprint than text, plus real
cost and latency. That's a deliberate v3 decision, not a limitation nobody
noticed: **this version stays text-only.**

In practice this covers more than it might sound like — the actual
Islamophobic content in most image/video posts is in the caption, title,
alt text, or comments, all of which are separate text elements the fixed
scanner already picks up. What it will *not* catch: hate symbols or slurs
baked directly into an image/video's pixels with no accompanying text.
That gap is a reasonable next step if it ends up mattering in practice —
it would mean a new backend endpoint using a vision-capable model, plus a
clear opt-in privacy notice, since it changes what leaves the device.


- Everything in the original Shield README under "Known limitations" still
  applies to the inbound wordlist itself.
- AI-assist adds latency (one network round-trip) and cost (one backend
  call) per eligible post it checks — it's capped and opt-in for that
  reason. Expect a brief delay before an AI-assisted blur appears, unlike
  the instant regex-based ones.
- AI-assist currently reuses the outbound module's narrow system prompt
  (Islamophobic tropes and misinformation only) — it does not check for
  the broader "hate_speech" category (slurs, incitement) the way the
  regex wordlist does. That category stays regex-only for now.
- The two modules still don't share a "you already saw this" state across
  each other — dismissing an outbound nudge on your own draft doesn't
  affect how the inbound module treats the same phrase if you see it in
  someone else's post later (and vice versa). Worth unifying if this goes
  further.
