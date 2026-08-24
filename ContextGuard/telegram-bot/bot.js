import TelegramBot from "node-telegram-bot-api";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";
const CONFIDENCE_THRESHOLD = 0.6;

if (!TOKEN) {
  console.error("Missing TELEGRAM_BOT_TOKEN in .env");
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

console.log("Context Guard Telegram bot is running...");
console.log(
  "Reminder: disable the bot's 'Group Privacy' mode via @BotFather (or make it an admin) so it can actually see group messages, not just commands."
);

async function analyze(text) {
  try {
    const res = await fetch(`${BACKEND_URL}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn("Analysis request failed:", err.message);
    return null;
  }
}

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "👋 Context Guard is active. I quietly check messages for common Islamophobic tropes and reply with a short, factual note — I never delete or block anything, and I never shame anyone publicly by name."
  );
});

bot.on("message", async (msg) => {
  if (!msg.text || msg.text.startsWith("/")) return;
  // Ignore very short messages — not enough signal to analyze meaningfully
  if (msg.text.trim().length < 12) return;

  const result = await analyze(msg.text);
  if (!result || !result.flagged || result.confidence < CONFIDENCE_THRESHOLD) return;

  const note =
    `💡 *Quick context* — ${escapeMarkdown(result.trope || "worth a second look")}\n` +
    `${escapeMarkdown(result.explanation || "")}\n\n` +
    `_This is just added context, not a moderation action — nothing has been removed._`;

  try {
    await bot.sendMessage(msg.chat.id, note, {
      reply_to_message_id: msg.message_id,
      parse_mode: "Markdown",
    });
  } catch (err) {
    console.warn("Failed to send reply:", err.message);
  }
});

function escapeMarkdown(str) {
  return str.replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1");
}
