import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Service-role cores must not be Server Actions: a "use server" export is a public RPC endpoint.
// They live in plain modules guarded by `import "server-only"`.
const SERVICE_ROLE_MODULES = [
  "telegram-poll.ts",
  "nudge.ts",
  "strategy-weekly.ts",
  "posts-core.ts",
  "publish.ts",
];

describe("service-role modules", () => {
  it.each(SERVICE_ROLE_MODULES)("%s is a plain server-only module, not a Server Action file", (file) => {
    const src = readFileSync(path.join(__dirname, file), "utf8");
    expect(src).not.toMatch(/^\s*["']use server["']/m);
    if (file !== "publish.ts") expect(src).toMatch(/^import "server-only";/m);
  });
});
