// wordlist.js
//
// Detection patterns for anti-Muslim hate speech and Islamophobic content.
// Both types below are BLOCKED by default — see content.js for the exact
// decision logic and the popup for per-type toggles if you want to soften
// one of them to a flag-only note instead.
//
//   type: "hate_speech"
//     Direct slurs and dehumanizing attacks (comparing people to animals,
//     explicit calls for exclusion/violence).
//
//   type: "islamophobic"
//     Conspiracy narratives, sweeping generalizations, delegitimizing
//     claims, and other content demeaning Muslims/Islam as a group.
//
// This is a STARTER set, not a comprehensive lexicon. Before real use:
//   1. Cross-reference with a vetted hate-speech dataset (e.g. HateCheck,
//      HateXplain, or a regional CVE/hate-monitoring org's lexicon).
//   2. Get review from people affected by this content and from someone
//      versed in your jurisdiction's legal definition of hate speech.
//   3. Keep this list versioned separately from code so it can be updated
//      without shipping a new extension build.
//
// Each entry:
//   pattern:    RegExp (case-insensitive, matches common variants/leetspeak)
//   type:       "hate_speech" | "islamophobic" — used for the toggle + label
//   category:   used to pick an educational reply template (data/replies.js)
//   confidence: "high" | "medium" | "low" — low-confidence entries only act
//               when the "strict mode" setting is enabled

const HS_PATTERNS = [
  // ───────────────────────────── Hate speech ────────────────────────────
  { pattern: /\br[a@4]g\W?head[s]?\b/i, type: "hate_speech", category: "slur", confidence: "high" },
  { pattern: /\bsand\W?n[i1]gg[e3]r[s]?\b/i, type: "hate_speech", category: "slur", confidence: "high" },
  { pattern: /\btowel\W?head[s]?\b/i, type: "hate_speech", category: "slur", confidence: "high" },
  { pattern: /\bmuz\W?rat[s]?\b/i, type: "hate_speech", category: "slur", confidence: "high" },
  { pattern: /\bpaki\b/i, type: "hate_speech", category: "slur", confidence: "high" },
  { pattern: /\bcamel\W?jockey[s]?\b/i, type: "hate_speech", category: "slur", confidence: "high" },
  { pattern: /\bmoon\W?cricket[s]?\b/i, type: "hate_speech", category: "slur", confidence: "high" },
  { pattern: /\bmuslims? (breed|multiply) (like|faster)\b/i, type: "hate_speech", category: "dehumanization", confidence: "high" },
  { pattern: /\bmuslims? (are|is)? ?(vermin|cockroaches|rats|parasites)\b/i, type: "hate_speech", category: "dehumanization", confidence: "high" },
  { pattern: /\b(kill|deport|remove) (all )?muslims\b/i, type: "hate_speech", category: "incitement", confidence: "high" },
  { pattern: /\bmuslims? (don't|do not) deserve to (live|exist)\b/i, type: "hate_speech", category: "incitement", confidence: "high" },

  // ──────────────────────────── Islamophobic ─────────────────────────────
  { pattern: /\ball muslims (are|is)\b/i, type: "islamophobic", category: "generalization", confidence: "medium" },
  { pattern: /\bmuslims (are all|are inherently)\b/i, type: "islamophobic", category: "generalization", confidence: "medium" },
  { pattern: /\bislam(ic)? invasion\b/i, type: "islamophobic", category: "invasion_trope", confidence: "medium" },
  { pattern: /\b(great replacement|eurabia)\b/i, type: "islamophobic", category: "invasion_trope", confidence: "medium" },
  { pattern: /\bislam is not a religion\b/i, type: "islamophobic", category: "delegitimize_trope", confidence: "medium" },
  { pattern: /\bno such thing as a moderate muslim\b/i, type: "islamophobic", category: "generalization", confidence: "medium" },
  { pattern: /\bislam(ists?)? want(s)? to (take over|conquer|destroy)\b/i, type: "islamophobic", category: "invasion_trope", confidence: "medium" },
  { pattern: /\bsharia (law )?is (taking over|coming for)\b/i, type: "islamophobic", category: "invasion_trope", confidence: "medium" },
  { pattern: /\bgo back to (your country|the desert)\b/i, type: "islamophobic", category: "xenophobia", confidence: "medium" },
  { pattern: /\ball terrorists are muslim\b/i, type: "islamophobic", category: "terrorism_trope", confidence: "medium" },
  { pattern: /\bevery (single )?muslim (is|supports)\b/i, type: "islamophobic", category: "generalization", confidence: "low" },
];

// Phrases that suppress a match even if a pattern hits — a crude context
// guard for quotes, news reporting, academic framing, condemnation, and
// counter-speech. Expand this list aggressively before real deployment;
// it's the main lever for cutting false positives, which matter more now
// that both categories above are blocked by default.
const HS_CONTEXT_GUARDS = [
  /\bquoting\b/i,
  /\baccording to (the )?(article|report|study)\b/i,
  /\breclaim(ed|ing)?\b/i,
  /\b(is|this is|that's|that is) (islamophobic|hate speech|racist|bigoted|unacceptable)\b/i,
  /\b(don't|do not|shouldn't|should not) say\b/i,
  /\bcondemn(s|ed|ing)?\b/i,
  /\bnews (report|article|coverage)\b/i,
  /^"/, // starts with a quote mark
];

if (typeof module !== "undefined") {
  module.exports = { HS_PATTERNS, HS_CONTEXT_GUARDS };
}
