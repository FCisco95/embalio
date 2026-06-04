export type MarkerKind = "face" | "screen" | "cta" | "retake";

export interface Marker {
  beatIndex: number;
  ms: number;        // milliseconds since the session/recording start
  label: string;
  kind?: MarkerKind;
}

const RESOLVE_COLOR: Record<MarkerKind, string> = {
  face: "Yellow",
  screen: "Blue",
  cta: "Green",
  retake: "Red",
};

function pad(n: number, width = 2): string {
  return String(n).padStart(width, "0");
}

/** Milliseconds → "HH:MM:SS:FF" at the given frame rate. */
export function msToTimecode(ms: number, fps: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const frames = Math.floor(((ms % 1000) / 1000) * fps);
  const hh = Math.floor(totalSeconds / 3600);
  const mm = Math.floor((totalSeconds % 3600) / 60);
  const ss = totalSeconds % 60;
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}:${pad(frames)}`;
}

function sanitize(label: string): string {
  return label.replace(/[|\r\n]+/g, " ").trim();
}

/** DaVinci Resolve "Import Timeline Markers from EDL" format. */
export function toResolveEDL(markers: Marker[], fps: number): string {
  const lines = ["TITLE: Embalio Session Markers", "FCM: NON-DROP FRAME", ""];
  markers.forEach((m, i) => {
    const tcIn = msToTimecode(m.ms, fps);
    const tcOut = msToTimecode(m.ms + Math.round(1000 / fps), fps);
    const color = RESOLVE_COLOR[m.kind ?? "face"];
    const evt = pad(i + 1, 3);
    lines.push(`${evt}  001  V  C  ${tcIn}  ${tcOut}  ${tcIn}  ${tcOut}`);
    lines.push(` |C:ResolveColor${color} |M:${sanitize(m.label)} |D:1`);
    lines.push("");
  });
  return lines.join("\n");
}

/** YouTube description chapters: first entry MUST be 0:00. */
export function toYouTubeChapters(markers: Marker[]): string {
  return markers
    .map((m, i) => {
      const totalSeconds = i === 0 ? 0 : Math.floor(m.ms / 1000);
      const mm = Math.floor(totalSeconds / 60);
      const ss = totalSeconds % 60;
      return `${mm}:${pad(ss)} ${sanitize(m.label)}`;
    })
    .join("\n");
}
