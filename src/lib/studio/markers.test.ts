import { describe, it, expect } from "vitest";
import { msToTimecode, toResolveEDL, toYouTubeChapters, type Marker } from "./markers";

const markers: Marker[] = [
  { beatIndex: 0, ms: 0, label: "B1 face hook", kind: "face" },
  { beatIndex: 1, ms: 18000, label: "B2 punch-zoom", kind: "screen" },
  { beatIndex: 2, ms: 65500, label: "B3 CTA", kind: "cta" },
];

describe("msToTimecode", () => {
  it("formats ms at 30fps as HH:MM:SS:FF", () => {
    expect(msToTimecode(0, 30)).toBe("00:00:00:00");
    expect(msToTimecode(65500, 30)).toBe("00:01:05:15"); // .5s * 30 = 15 frames
  });
  it("formats at 24fps", () => {
    expect(msToTimecode(1000, 24)).toBe("00:00:01:00");
  });
});

describe("toResolveEDL", () => {
  it("emits a header and one event per marker with color + label", () => {
    const edl = toResolveEDL(markers, 30);
    expect(edl).toContain("TITLE: Embalio Session Markers");
    expect(edl).toContain("FCM: NON-DROP FRAME");
    expect(edl).toContain("|C:ResolveColorYellow");   // face
    expect(edl).toContain("|C:ResolveColorBlue");      // screen
    expect(edl).toContain("|C:ResolveColorGreen");     // cta
    expect(edl).toContain("|M:B2 punch-zoom");
    expect(edl).toContain("00:01:05:15");              // B3 timecode at 30fps
  });
  it("sanitizes pipe and newline characters out of labels", () => {
    const edl = toResolveEDL([{ beatIndex: 0, ms: 0, label: "bad|label\nhere", kind: "face" }], 30);
    expect(edl).toContain("|M:bad label here");
  });
});

describe("toYouTubeChapters", () => {
  it("forces the first entry to 0:00 and uses m:ss formatting", () => {
    const txt = toYouTubeChapters(markers);
    const lines = txt.trim().split("\n");
    expect(lines[0]).toBe("0:00 B1 face hook");
    expect(lines[1]).toBe("0:18 B2 punch-zoom");
    expect(lines[2]).toBe("1:05 B3 CTA");
  });
});
