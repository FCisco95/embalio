import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function readHandoff(): Promise<string> {
  try {
    const filePath = join(process.cwd(), "docs", "HANDOFF.md");
    return await readFile(filePath, "utf-8");
  } catch {
    return "(no handoff file found — describe what you're building in the journal entry above)";
  }
}
