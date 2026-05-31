import { withRetry } from "@/lib/retry";

const API_BASE = "https://api.telegram.org";

export interface TelegramButton {
  /** Button label shown to the user. */
  text: string;
  /** Callback payload delivered back when tapped (≤64 bytes). */
  data: string;
}

export interface SendOpts {
  /** Inline keyboard, row-major. e.g. [[posted, skip], [regen]]. */
  buttons?: TelegramButton[][];
  /** Suppress the link preview card (tweets render their own). Default true. */
  disablePreview?: boolean;
  /** Telegram formatting. "HTML" enables <b>/<code> (code = tap-to-copy on mobile). */
  parseMode?: "HTML" | "MarkdownV2";
  /** Injectable for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

function config(): { token: string; chatId: string } {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    throw new Error("TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set");
  }
  return { token, chatId };
}

/**
 * Push a plain-text message to the configured Telegram chat. URLs auto-link, so
 * no markdown escaping is needed. Transient network/5xx failures are retried.
 */
export async function sendTelegram(text: string, opts: SendOpts = {}): Promise<void> {
  const { token, chatId } = config();
  const fetchImpl = opts.fetchImpl ?? fetch;

  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    disable_web_page_preview: opts.disablePreview ?? true,
  };
  if (opts.parseMode) body.parse_mode = opts.parseMode;
  if (opts.buttons) {
    body.reply_markup = {
      inline_keyboard: opts.buttons.map((row) =>
        row.map((b) => ({ text: b.text, callback_data: b.data })),
      ),
    };
  }

  await withRetry(
    async () => {
      const res = await fetchImpl(`${API_BASE}/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`Telegram sendMessage failed (${res.status}): ${detail}`);
      }
    },
    { retries: 2, baseMs: 500, onRetry: (e) => console.error("telegram retry:", e) },
  );
}
