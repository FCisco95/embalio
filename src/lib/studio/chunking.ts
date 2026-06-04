export type ChunkMode = "para" | "sent";

const ABBREVIATIONS = ["e.g.", "i.e.", "etc.", "vs.", "mr.", "mrs.", "dr.", "st."];

/** Split a beat's spoken text into display lines. `para` = the whole line; `sent` = one sentence each. */
export function toLines(say: string, mode: ChunkMode): string[] {
  const text = say.trim();
  if (!text) return [];
  if (mode === "para") return [text];

  // Protect abbreviations from the splitter, then split on sentence terminators
  // followed by whitespace and an uppercase/quote/paren start.
  let guarded = text;
  ABBREVIATIONS.forEach((abbr, i) => {
    guarded = guarded.replace(new RegExp(escapeRegExp(abbr), "gi"), ` ${i} `);
  });
  const parts = guarded.split(/(?<=[.!?])\s+(?=[A-Z"'(])/);
  const restore = (s: string) =>
    ABBREVIATIONS.reduce((acc, abbr, i) => acc.replaceAll(` ${i} `, abbr), s);
  return parts.map((p) => restore(p).trim()).filter(Boolean);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
