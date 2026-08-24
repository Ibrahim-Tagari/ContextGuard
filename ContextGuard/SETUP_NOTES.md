# Merge notes

You uploaded two separately-fixed copies of Context Guard. They turned out to
be the same project with two different fixes applied, one per copy — not two
different feature sets. This copy combines them by keeping whichever version
of each differing file was more complete, rather than keeping both.

## Where they differed, and what was kept

**`backend/server.js` / `backend/package.json`** — one copy still called
Gemini through `@google/generative-ai`, which Google has deprecated and
archived. That SDK is also the one that fails against the newer `AQ.`-prefix
API keys Google AI Studio now issues to many accounts (401
`ACCESS_TOKEN_TYPE_UNSUPPORTED`). The other copy had already been migrated to
the current `@google/genai` SDK, which handles both key formats. **Kept: the
`@google/genai` version.**

**`extension-unified/content-inbound.js` / `content-inbound.css`** (the
Shield card that blurs flagged content) — one copy had an older, simpler
always-expanded card with a low `z-index` and no sizing logic, which can get
buried under a host site's own header/modal or clip awkwardly on short posts.
The other copy had a refined version: the card collapses to a compact badge
by default (click to expand the full explanation), sits in its own stacking
context with a much higher `z-index` so host-page UI can't cover it, and
resizes the blurred post to fit the card instead of overlapping the next
post. **Kept: the refined, collapsible version.**

Everything else — the outbound nudge tool, the Telegram bot, the wordlist,
the popup/options UI, the non-unified `extension/` — was byte-identical
between the two copies, so it carried over unchanged.

## Before running it

1. `cd backend && cp .env.example .env`, then paste in a real Gemini API key
   from [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
2. `npm install` (this copy does not ship `node_modules` — install fresh
   rather than reusing a bundled one, so you get versions that match your
   own Node/OS).
3. `npm start`, then confirm with:
   ```bash
   curl -X POST http://localhost:3000/analyze \
     -H "Content-Type: application/json" \
     -d '{"text":"all muslims are terrorists"}'
   ```
4. Load `extension-unified/` as an unpacked extension in
   `chrome://extensions` (Developer mode → Load unpacked).

Neither uploaded copy's `.env.example` should ever contain a real-looking
key — treat any key that was ever committed to either copy as compromised
and rotate it in AI Studio if you haven't already.
