// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Cockpit } from "./cockpit";
import { DEFAULT_LAYOUT } from "@/lib/studio/teleprompter-layout";
import type { VideoScript } from "@/lib/studio/schemas";

const script: VideoScript = {
  title: "t",
  hook: "h",
  beats: [
    { id: "1", say: "First line. Second line.", visualPrompt: "v", do: "Click run", fx: "zoom" },
    { id: "2", say: "Next beat.", visualPrompt: "v2" },
  ],
};

const LS_KEY = "embalio.teleprompter.store";

/** Seed the localStorage-backed teleprompter store the component reads on mount. */
function seedLayout(overrides: Partial<typeof DEFAULT_LAYOUT>) {
  localStorage.setItem(
    LS_KEY,
    JSON.stringify({ presets: {}, last: { ...DEFAULT_LAYOUT, ...overrides } }),
  );
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("Cockpit", () => {
  it("renders the current beat say with no next-beat preview", () => {
    render(<Cockpit script={script} projectId="p" recordingProfileId="r" />);
    expect(screen.getByText("First line. Second line.")).toBeTruthy();
    expect(screen.queryByText(/next →/)).toBeNull();
  });

  it("walks sentence-mode lines then spills into the next beat", () => {
    seedLayout({ mode: "sent", lines: 1 });
    render(<Cockpit script={script} projectId="p" recordingProfileId="r" />);

    // sentence mode shows only the first sentence of beat 1
    expect(screen.getByText("First line.")).toBeTruthy();
    expect(screen.queryByText("Second line.")).toBeNull();

    // ArrowRight walks to the second sentence (still beat 1)
    fireEvent.keyDown(window, { code: "ArrowRight" });
    expect(screen.getByText("Second line.")).toBeTruthy();
    expect(screen.queryByText("First line.")).toBeNull();

    // ArrowRight again spills into the next beat's say
    fireEvent.keyDown(window, { code: "ArrowRight" });
    expect(screen.getByText("Next beat.")).toBeTruthy();
  });

  it("mirrors the card from layout.mirror (persisted via store)", () => {
    seedLayout({ mirror: true });
    render(<Cockpit script={script} projectId="p" recordingProfileId="r" />);

    const card = screen.getByText("First line. Second line.")
      .parentElement as HTMLElement;
    expect(card.style.transform).toBe("scaleX(-1)");
  });

  it("renders no mirror transform when layout.mirror is false", () => {
    seedLayout({ mirror: false });
    render(<Cockpit script={script} projectId="p" recordingProfileId="r" />);

    const card = screen.getByText("First line. Second line.")
      .parentElement as HTMLElement;
    expect(card.style.transform).toBe("");
  });

  it("renders the current line plus read-ahead lines in sentence mode (lines: 2)", () => {
    seedLayout({ mode: "sent", lines: 2 });
    render(<Cockpit script={script} projectId="p" recordingProfileId="r" />);

    // both sentences of beat 1 are visible at once
    const first = screen.getByText("First line.");
    const second = screen.getByText("Second line.");
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    // the read-ahead line is near-white (slightly dimmed vs the current line)
    expect((second as HTMLElement).className).toContain("text-white/85");
    expect((first as HTMLElement).className).not.toContain("text-white/85");
  });

  it("renders only the current line in sentence mode (lines: 1)", () => {
    seedLayout({ mode: "sent", lines: 1 });
    render(<Cockpit script={script} projectId="p" recordingProfileId="r" />);

    expect(screen.getByText("First line.")).toBeTruthy();
    expect(screen.queryByText("Second line.")).toBeNull();
  });

  it("backfills a stale persisted layout missing the `lines` field (sentence mode)", () => {
    // Simulate a layout persisted before `lines` existed: sentence mode but no
    // `lines` key. Without normalization, slice(start, start + undefined) yields
    // an empty array → blank teleprompter for returning users.
    const stale: Record<string, unknown> = { ...DEFAULT_LAYOUT, mode: "sent" };
    delete stale.lines;
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({ presets: {}, last: stale }),
    );
    render(<Cockpit script={script} projectId="p" recordingProfileId="r" />);

    // The current sentence must still be visible (not blank).
    expect(screen.getByText("First line.")).toBeTruthy();
  });

  it("manual script: each line is its own chunk (beat)", () => {
    localStorage.setItem("embalio.teleprompter.manual", "Chunk A here.\n\nChunk B after.");
    render(<Cockpit script={script} projectId="p" recordingProfileId="r" />);

    // Paragraph mode: one line of the manual text per screen.
    expect(screen.getByText("Chunk A here.")).toBeTruthy();
    expect(screen.queryByText("Chunk B after.")).toBeNull();

    fireEvent.keyDown(window, { code: "ArrowRight" });
    expect(screen.getByText("Chunk B after.")).toBeTruthy();
    expect(screen.queryByText("Chunk A here.")).toBeNull();
  });

  it("manual script overrides the generated beats and walks sentence by sentence", () => {
    seedLayout({ mode: "sent", lines: 1 });
    localStorage.setItem("embalio.teleprompter.manual", "Manual one. Manual two.");
    render(<Cockpit script={script} projectId="p" recordingProfileId="r" />);

    // Manual text replaces the script's say entirely.
    expect(screen.getByText("Manual one.")).toBeTruthy();
    expect(screen.queryByText("First line.")).toBeNull();

    fireEvent.keyDown(window, { code: "ArrowRight" });
    expect(screen.getByText("Manual two.")).toBeTruthy();
  });

  it("locked mode shows only the text and a lock icon — no controls", () => {
    render(<Cockpit script={script} projectId="p" recordingProfileId="r" />);

    expect(screen.getByText("First line. Second line.")).toBeTruthy();
    expect(screen.getByTitle("unlock teleprompter")).toBeTruthy();
    // No control strip while locked.
    expect(screen.queryByTitle("text bigger")).toBeNull();
    expect(screen.queryByTitle("close overlay")).toBeNull();
    expect(screen.queryByText("Start session")).toBeNull();
  });

  it("unlocking via the lock icon reveals the control strip", () => {
    render(<Cockpit script={script} projectId="p" recordingProfileId="r" />);

    fireEvent.click(screen.getByTitle("unlock teleprompter"));

    expect(screen.getByTitle("lock (click-through)")).toBeTruthy();
    expect(screen.getByTitle("text bigger")).toBeTruthy();
    expect(screen.getByTitle("more sentences")).toBeTruthy();
    expect(screen.getByTitle("close overlay")).toBeTruthy();
    // The lock icon itself is gone while unlocked.
    expect(screen.queryByTitle("unlock teleprompter")).toBeNull();
  });

  it("applies layout height to the pill and opacity as its backdrop darkness", () => {
    seedLayout({ mode: "sent", height: 200, opacity: 0.5 });
    render(<Cockpit script={script} projectId="p" recordingProfileId="r" />);

    const pill = screen.getByText("First line.").parentElement as HTMLElement;
    expect(pill.style.maxHeight).toBe("200px");
    // Text stays full strength — opacity darkens the backdrop pill instead.
    expect(pill.style.backgroundColor).toBe("rgba(0, 0, 0, 0.5)");
  });
});
