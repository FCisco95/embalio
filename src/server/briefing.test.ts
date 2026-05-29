import { describe, it, expect, vi, beforeEach } from "vitest"

// Build a chainable mock that handles both the select chain and insert chain
function makeMockSingle(returnVal: unknown) {
  return vi.fn().mockResolvedValue(returnVal)
}

function makeChain(singleReturn: unknown) {
  const single = makeMockSingle(singleReturn)
  const obj: Record<string, unknown> = { single }
  const chain = new Proxy(obj, {
    get(target, key) {
      if (key === "single") return target.single
      return () => new Proxy(obj, this)
    },
  })
  return { chain, single }
}

vi.mock("@/lib/supabase/server", () => ({
  supabaseService: vi.fn(),
}))

vi.stubEnv("FIXED_PROFILE_ID", "test-profile-id")

describe("getWeeklyBriefing", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("returns null when no briefing exists for the date", async () => {
    const { supabaseService } = await import("@/lib/supabase/server")
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    })
    vi.mocked(supabaseService).mockReturnValue({ from: mockFrom } as never)

    const { getWeeklyBriefing } = await import("./briefing")
    const result = await getWeeklyBriefing("2026-05-29")
    expect(result).toBeNull()
  })

  it("returns cached briefing when row exists", async () => {
    const cached = {
      id: "abc",
      profile_id: "test-profile-id",
      date: "2026-05-29",
      summary: "Weekly summary",
      topics: ["AI"],
      created_at: "2026-05-29T10:00:00Z",
    }
    const { supabaseService } = await import("@/lib/supabase/server")
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: cached, error: null }),
          }),
        }),
      }),
    })
    vi.mocked(supabaseService).mockReturnValue({ from: mockFrom } as never)

    const { getWeeklyBriefing } = await import("./briefing")
    const result = await getWeeklyBriefing("2026-05-29")
    expect(result).toEqual(cached)
  })
})
