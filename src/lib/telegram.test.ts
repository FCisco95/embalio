import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendTelegram } from "./telegram";

function okResponse() {
  return { ok: true, status: 200, text: () => Promise.resolve("{}") } as unknown as Response;
}

beforeEach(() => {
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "123:ABC");
  vi.stubEnv("TELEGRAM_CHAT_ID", "555");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sendTelegram", () => {
  it("posts text to the bot's sendMessage endpoint with the configured chat", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse());
    await sendTelegram("hello", { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.telegram.org/bot123:ABC/sendMessage");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toMatchObject({ chat_id: "555", text: "hello", disable_web_page_preview: true });
  });

  it("encodes inline buttons as a callback keyboard", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse());
    await sendTelegram("pick", {
      fetchImpl,
      buttons: [[{ text: "✅ Posted", data: "posted:1" }, { text: "⏭️ Skip", data: "skip:1" }]],
    });
    const body = JSON.parse((fetchImpl.mock.calls[0][1] as RequestInit).body as string);
    expect(body.reply_markup).toEqual({
      inline_keyboard: [[
        { text: "✅ Posted", callback_data: "posted:1" },
        { text: "⏭️ Skip", callback_data: "skip:1" },
      ]],
    });
  });

  it("sets parse_mode when provided", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse());
    await sendTelegram("<b>hi</b>", { fetchImpl, parseMode: "HTML" });
    const body = JSON.parse((fetchImpl.mock.calls[0][1] as RequestInit).body as string);
    expect(body.parse_mode).toBe("HTML");
  });

  it("throws a clear error when credentials are missing", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    await expect(sendTelegram("x")).rejects.toThrow("TELEGRAM_BOT_TOKEN");
  });

  it("retries on a failed send then surfaces the error", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false, status: 500, text: () => Promise.resolve("boom"),
    } as unknown as Response);
    await expect(sendTelegram("x", { fetchImpl })).rejects.toThrow("Telegram sendMessage failed (500)");
    expect(fetchImpl).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });
});

import { getTelegramUpdates, answerCallbackQuery } from "./telegram";

function updatesResponse(result: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve({ ok: true, result }) } as unknown as Response;
}

describe("getTelegramUpdates", () => {
  it("returns callback queries and the next offset", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(updatesResponse([
      { update_id: 41, callback_query: { id: "q1", data: "posted:c1", message: { message_id: 7, chat: { id: 555 } } } },
      { update_id: 42, message: { text: "ignored non-callback" } },
    ]));
    const r = await getTelegramUpdates(0, { fetchImpl });
    expect(r.nextOffset).toBe(43);
    expect(r.callbacks).toEqual([{ id: "q1", data: "posted:c1", messageId: 7, chatId: 555 }]);
    const [url] = fetchImpl.mock.calls[0];
    expect(url).toContain("/bot123:ABC/getUpdates");
    expect(url).toContain("offset=0");
  });

  it("keeps the same offset when there are no updates", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(updatesResponse([]));
    const r = await getTelegramUpdates(99, { fetchImpl });
    expect(r.nextOffset).toBe(99);
    expect(r.callbacks).toEqual([]);
  });
});

describe("answerCallbackQuery", () => {
  it("posts the callback id and optional toast text", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve("{}") } as unknown as Response);
    await answerCallbackQuery("q1", "✅ Logged", { fetchImpl });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.telegram.org/bot123:ABC/answerCallbackQuery");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toMatchObject({ callback_query_id: "q1", text: "✅ Logged" });
  });
});
