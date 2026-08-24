# Context Guard

A hackathon project that gives people gentle, factual context on Islamophobic
tropes and misinformation *before* they post or right after someone else
posts — without ever blocking, deleting, or censoring content.

Two front-ends, one shared AI backend:

- **Browser extension** — watches text boxes on X and Telegram Web (and can
  easily be extended to any site) and shows an inline nudge as you type.
- **Telegram bot** — sits in a group chat and quietly replies with context
  when it sees a flagged pattern.

## Two versions of the browser extension

- **`extension/`** — the original, outbound-only nudge tool. Checks your
  own drafts before you post. Never blocks anything.
- **`extension-unified/`** — merges in a second project, **Islamophobia
  Shield**, which blurs Islamophobic content in what you're *reading*
  (with a one-click, fully reversible "Show post anyway"). The two modules
  share the same AI backend — Shield's regex-based detection can optionally
  be topped up by the same classifier the nudge tool uses, for posts its
  wordlist misses. See `extension-unified/README.md` for the full writeup,
  including an honest note on reconciling "nudge, don't block" with a tool
  that does block by default (reversibly).

Use `extension/` for the simpler outbound-only demo; use
`extension-unified/` if you want both directions — writing and reading —
in one install.

## How it works

1. User types something in a monitored text box (extension) or sends a
   message in a Telegram group (bot).
2. After a short debounce, the text is sent to the backend `/analyze`
   endpoint.
3. The backend asks Gemini (free tier) to classify the text *only* for
   Islamophobic tropes/dehumanization/misinformation — not general
   moderation.
4. If flagged with reasonable confidence, the user sees a short, sourced
   explanation. Nothing is ever removed or blocked — this is context, not
   censorship.

## Project structure

```
islamophobia-guard/
├── backend/          Express server, calls the Anthropic API
├── extension/         Manifest V3 browser extension (X + Telegram Web)
└── telegram-bot/      Telegram bot using the same backend
```

## Setup

### 1. Backend

Get a free Gemini API key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
(sign in with a Google account, click "Create API key" — no payment info
required for the free tier).

```bash
cd backend
cp .env.example .env    # add your GEMINI_API_KEY
npm install
npm start
```

Runs on `http://localhost:3000` by default. Test it:

```bash
curl -X POST http://localhost:3000/analyze \
  -H "Content-Type: application/json" \
  -d '{"text":"all muslims are terrorists"}'
```

### 2. Browser extension

1. Go to `chrome://extensions`, enable **Developer mode**.
2. Click **Load unpacked**, select the `extension/` folder.
3. Click the extension icon, confirm the backend URL is
   `http://localhost:3000`, and make sure **Enabled** is checked.
4. Go to x.com or web.telegram.org, start typing in a compose box.

Note: you'll need to add a placeholder `icon.png` (128x128) to the
`extension/` folder, or remove the `icons` field from `manifest.json` — it's
omitted here since binary icon files aren't included in this scaffold.

### 3. Telegram bot

1. Message [@BotFather](https://t.me/BotFather) on Telegram, run `/newbot`,
   grab the token.
2. **Important**: run `/setprivacy` with BotFather and set it to **Disabled**
   for your bot, so it can actually read group messages (not just
   commands/mentions). Alternatively, make the bot a group admin.
3. Add the bot to a test group.

```bash
cd telegram-bot
cp .env.example .env    # add your TELEGRAM_BOT_TOKEN
npm install
npm start
```

Send a flagged-style message in the group and watch it reply with context.

## Demo script (for judges)

1. Show the browser extension flagging a trope live in an X compose box.
2. Switch to Telegram Web, show the same extension working there too — same
   codebase, no platform-specific integration needed.
3. Switch to a Telegram group chat, send a message from a phone/second
   account, show the bot replying with context in real time.
4. Emphasize: **nothing is deleted or blocked** — this sidesteps the
   censorship debate entirely and focuses purely on giving people
   information to make their own choice.

## Known limitations (be upfront about these if asked)

- The extension currently targets X and Telegram Web by domain; adding more
  sites just means adding domains to `manifest.json`'s `matches` field.
- False positives/negatives are possible — the system prompt is intentionally
  conservative, but this is a classifier, not ground truth. Framing it as
  "context" rather than "fact-checking" matters for this reason.
- The Telegram bot currently replies in the group publicly; a gentler
  alternative for a v2 would be a private DM to the sender instead.
- No on-device processing yet — all text goes to the backend, which calls
  the Gemini API. Worth being transparent about this with users in a real
  deployment (privacy policy, opt-in consent, etc).
- The Gemini free tier has rate limits (requests per minute). Fine for a
  live demo with a handful of people typing, but you'd want a paid tier or
  a queueing strategy for real usage.
