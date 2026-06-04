// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Cockpit } from "./cockpit";
import type { VideoScript } from "@/lib/studio/schemas";

const script: VideoScript = {
  title: "t",
  hook: "h",
  beats: [
    { id: "1", say: "First line. Second line.", visualPrompt: "v", do: "Click run", fx: "zoom" },
    { id: "2", say: "Next beat.", visualPrompt: "v2" },
  ],
};

afterEach(() => cleanup());

describe("Cockpit", () => {
  it("renders the current beat say + next peek", () => {
    render(<Cockpit script={script} projectId="p" recordingProfileId="r" />);
    expect(screen.getByText("First line. Second line.")).toBeTruthy();
    expect(screen.getByText(/next →/)).toBeTruthy();
  });
});
