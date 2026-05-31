import { describe, it, expect, vi, beforeEach } from "vitest";

// Chainable + awaitable Supabase stub: awaiting any built query resolves to the
// result configured for the table named in the most recent from(...).
function makeSupabase(byTable: Record<string, unknown>) {
  let current: unknown = { data: null };
  const chain: unknown = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "then") return (resolve: (v: unknown) => void) => resolve(current);
        return () => chain;
      },
    },
  );
  return { from: (table: string) => { current = byTable[table] ?? { data: null }; return chain; } };
}

const scanTargetsForProfile = vi.fn();
const draftRepliesForProfile = vi.fn();
const sendTelegram = vi.fn().mockResolvedValue(undefined);

vi.mock("@/server/targeting", () => ({ scanTargetsForProfile, draftRepliesForProfile }));
vi.mock("@/lib/telegram", () => ({ sendTelegram }));
vi.mock("@/lib/supabase/server", () => ({ supabaseService: vi.fn() }));

async function setSupabase(byTable: Record<string, unknown>) {
  const { supabaseService } = await import("@/lib/supabase/server");
  vi.mocked(supabaseService).mockReturnValue(makeSupabase(byTable) as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  scanTargetsForProfile.mockResolvedValue(3);
  draftRepliesForProfile.mockResolvedValue(3);
});

describe("runPulse", () => {
  it("pushes each top opportunity to Telegram with its pre-written comment + buttons", async () => {
    await setSupabase({
      candidates: { data: [
        { id: "c1", author_handle: "@a", tweet_text: "hot take", tweet_url: "https://x.com/a/1", score_composite: 0.9 },
        { id: "c2", author_handle: "@b", tweet_text: "another", tweet_url: "https://x.com/b/2", score_composite: 0.8 },
      ] },
      drafts: { data: [{ body: "sharp reply" }] },
    });

    const { runPulse } = await import("@/server/pulse");
    const result = await runPulse("p1");

    expect(result).toEqual({ surfaced: 3, drafted: 3, sent: 2 });
    expect(sendTelegram).toHaveBeenCalledTimes(2);

    const [text, opts] = sendTelegram.mock.calls[0];
    expect(text).toContain("@a");
    expect(text).toContain("hot take");
    expect(text).toContain("sharp reply");
    expect(text).toContain("https://x.com/a/1");
    expect(opts.buttons[0][0]).toEqual({ text: "✅ Posted", data: "posted:c1" });
    expect(opts.buttons[0][1]).toEqual({ text: "⏭️ Skip", data: "skip:c1" });
  });

  it("skips candidates that have no drafted reply yet", async () => {
    await setSupabase({
      candidates: { data: [{ id: "c1", author_handle: "@a", tweet_text: "x", tweet_url: "u", score_composite: 0.9 }] },
      drafts: { data: [] },
    });

    const { runPulse } = await import("@/server/pulse");
    const result = await runPulse("p1");

    expect(result.sent).toBe(0);
    expect(sendTelegram).not.toHaveBeenCalled();
  });

  it("can skip the refresh step (deliver-only)", async () => {
    await setSupabase({ candidates: { data: [] }, drafts: { data: [] } });
    const { runPulse } = await import("@/server/pulse");
    await runPulse("p1", { refresh: false });
    expect(scanTargetsForProfile).not.toHaveBeenCalled();
    expect(draftRepliesForProfile).not.toHaveBeenCalled();
  });
});
