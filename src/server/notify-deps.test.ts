import { describe, it, expect, beforeEach } from "vitest";
import { buildNotifyDeps } from "./notify-deps";

function fakeSb() {
  return { from: () => ({ select: () => ({ eq: async () => ({ data: [] }) }), delete: () => ({ eq: async () => ({}) }) }) } as never;
}

describe("buildNotifyDeps", () => {
  beforeEach(() => { delete process.env.TELEGRAM_BOT_TOKEN; delete process.env.TELEGRAM_CHAT_ID; });

  it("omits sendTelegram when env is not configured", () => {
    expect(buildNotifyDeps(fakeSb()).sendTelegram).toBeUndefined();
  });

  it("wires sendTelegram when env is configured", () => {
    process.env.TELEGRAM_BOT_TOKEN = "t"; process.env.TELEGRAM_CHAT_ID = "c";
    expect(typeof buildNotifyDeps(fakeSb()).sendTelegram).toBe("function");
  });
});
