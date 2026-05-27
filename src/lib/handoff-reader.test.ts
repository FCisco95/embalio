import { describe, it, expect, vi } from "vitest";
import * as fs from "node:fs/promises";

vi.mock("node:fs/promises");

import { readHandoff } from "@/lib/handoff-reader";

describe("readHandoff", () => {
  it("returns the full handoff text when file exists", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(fs.readFile as any).mockResolvedValueOnce("# Resonance Handoff\n\n## What was built\n\nSpine 1");
    const text = await readHandoff();
    expect(text).toContain("Spine 1");
  });

  it("returns a fallback string when file does not exist", async () => {
    vi.mocked(fs.readFile).mockRejectedValueOnce(new Error("ENOENT"));
    const text = await readHandoff();
    expect(text).toContain("no handoff file found");
  });
});
