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
  it("renders the current beat say + next peek", () => {
    render(<Cockpit script={script} projectId="p" recordingProfileId="r" />);
    expect(screen.getByText("First line. Second line.")).toBeTruthy();
    expect(screen.getByText(/next →/)).toBeTruthy();
  });

  it("walks sentence-mode lines then spills into the next beat", () => {
    seedLayout({ mode: "sent" });
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

  it("applies layout height to the card and opacity to the container", () => {
    seedLayout({ mode: "sent", height: 200, opacity: 0.5 });
    const { container } = render(
      <Cockpit script={script} projectId="p" recordingProfileId="r" />,
    );

    const root = container.firstChild as HTMLElement;
    expect(root.style.opacity).toBe("0.5");

    const card = screen.getByText("First line.").parentElement as HTMLElement;
    expect(card.style.maxHeight).toBe("200px");
  });
});
