import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "50kb" }));

// Basic abuse protection — tune for your hackathon demo
const limiter = rateLimit({ windowMs: 60 * 1000, max: 30 });
app.use("/analyze", limiter);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite"; // current-gen, free-tier friendly; override via .env if Google renames/retires this

// The system prompt is the actual "policy" of the tool. Keep it narrow,
// evidence-based, and focused on nudging rather than censoring.
const SYSTEM_PROMPT = `You are a content-context assistant. Your job is to review a short piece of user-drafted text (a social media post, comment, or chat message) and check ONLY for Islamophobic tropes, dehumanizing language about Muslims, or common misinformation/conspiracy framings about Islam or Muslims.

You are NOT a general content moderator. Do not flag things for other reasons (politics you disagree with, other forms of offensive language, disagreement with Islam as a religion, criticism of specific state policies of majority-Muslim countries, etc). Legitimate criticism, questions, jokes, and strong opinions are NOT automatically Islophobic — only flag actual dehumanization, hateful generalizations, or well-documented misinformation tropes (e.g. "all Muslims are terrorists", "Islam is inherently violent", "Muslims are invading/replacing us", conflating Islam with terrorism, Muslim = terrorist framing, etc).

Respond ONLY with a JSON object, no other text, no markdown fences, in this exact shape:
{
  "flagged": boolean,
  "confidence": number, // 0-1, how confident you are this is a real instance of the pattern above
  "trope": string | null, // short name of the trope/pattern detected, or null
  "explanation": string | null, // ONE short sentence (under 25 words) explaining the pattern and, where possible, the actual fact that contradicts it
  "tone": "nudge" | null // always "nudge" if flagged — this tool never blocks, only informs
}

Be conservative: if it's ambiguous, sarcastic in a way that could go either way, or clearly a factual/historical statement, do not flag it. False positives erode trust in this tool fast.`;

// We need to classify hateful/dehumanizing text in order to flag it —
// default safety thresholds can block the model from even analyzing it.
// This does NOT make the tool produce hateful content; it only lets the
// classifier see and label the input.
const SAFETY_SETTINGS = [
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
];

app.post("/analyze", async (req, res) => {
  const { text } = req.body || {};

  if (!text || typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "Missing 'text' field" });
  }
  if (text.length > 2000) {
    return res.status(400).json({ error: "Text too long" });
  }

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: text,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        maxOutputTokens: 300,
        safetySettings: SAFETY_SETTINGS,
      },
    });

    if (!response || response.promptFeedback?.blockReason) {
      console.warn(
        "Gemini blocked this input:",
        response?.promptFeedback?.blockReason
      );
      // Fail safe: treat as "not flagged" rather than erroring out, so the
      // demo doesn't break — but log it so you know it happened.
      return res.json({
        flagged: false,
        confidence: 0,
        trope: null,
        explanation: null,
        tone: null,
      });
    }

    const raw = (response.text || "")
      .trim()
      .replace(/^```json\s*|\s*```$/g, "");

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (parseErr) {
      console.error("Failed to parse model output:", raw);
      return res.status(502).json({ error: "Model returned unparseable output" });
    }

    return res.json(parsed);
  } catch (err) {
    console.error("Gemini API error:", err);
    return res.status(500).json({ error: "Analysis failed" });
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Context Guard backend listening on port ${PORT}`);
});
