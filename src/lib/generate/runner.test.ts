import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";

const spawnMock = vi.fn();
vi.mock("node:child_process", () => ({ spawn: (...args: unknown[]) => spawnMock(...args) }));

import { buildClaudeArgs, claudeCliRunner } from "@/lib/generate/runner";

describe("buildClaudeArgs", () => {
  it("uses print mode and no tools by default", () => {
    expect(buildClaudeArgs({})).toEqual(["-p"]);
  });
  it("allows web tools when research is requested", () => {
    expect(buildClaudeArgs({ research: true })).toEqual(["-p", "--allowedTools", "WebSearch", "WebFetch"]);
  });
});

// Security regression: the prompt must NEVER reach argv (where it could be
// shell-interpreted under shell:true, or leak via process listings). It must
// only ever be written to the child's stdin. See runner.ts comment.
describe("claudeCliRunner — prompt goes via stdin, never argv", () => {
  function fakeChild() {
    const child = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter; stderr: EventEmitter;
      stdin: { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };
      kill: ReturnType<typeof vi.fn>;
    };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = { write: vi.fn(), end: vi.fn() };
    child.kill = vi.fn();
    return child;
  }

  it("passes only hardcoded flags as args and writes the prompt to stdin", async () => {
    const SENSITIVE_PROMPT = "secret-prompt; rm -rf / # $(whoami)";
    let child: ReturnType<typeof fakeChild>;
    spawnMock.mockImplementation(() => {
      child = fakeChild();
      queueMicrotask(() => child.emit("close", 0));
      return child;
    });

    await claudeCliRunner(buildClaudeArgs({ research: true }), SENSITIVE_PROMPT);

    const [cmd, args] = spawnMock.mock.calls[0];
    expect(cmd).toBe("claude");
    expect(args).toEqual(["-p", "--allowedTools", "WebSearch", "WebFetch"]);
    // the prompt must not appear anywhere in argv
    expect(JSON.stringify(args)).not.toContain("secret-prompt");
    // it must be written to stdin instead
    expect(child!.stdin.write).toHaveBeenCalledWith(SENSITIVE_PROMPT);
    expect(child!.stdin.end).toHaveBeenCalled();
  });
});
