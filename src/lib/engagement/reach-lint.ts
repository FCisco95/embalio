// src/lib/engagement/reach-lint.ts
/**
 * Reach-lint: the Rank-2 reach-audit rules (Session-19 handoff) as a pure
 * pre-post checklist. Advisory ONLY — findings are rendered as warnings and
 * nudges next to the composer textarea; nothing ever blocks a post. Rules:
 *   main tweet = hook + native media · every link goes in reply 1 ·
 *   long multi-paragraph posts ship as threads with the hook line solo.
 */

export type ReachLintKind = "post" | "hook" | "body";
export type ReachLintSeverity = "warn" | "info";

export interface ReachLintFinding {
  code: "link_in_main" | "thread_split" | "hook_not_solo" | "native_media";
  severity: ReachLintSeverity;
  message: string;
}

const URL_RE = /https?:\/\/\S+/i;
const MAIN_TWEET_MAX = 280;   // X single-tweet limit — beyond it this is a thread
const HOOK_SOLO_MAX = 200;    // a hook should be one punchy line, not a paragraph
const SPLIT_PARAGRAPHS = 3;   // 3+ paragraphs read as an essay → thread it

const paragraphsOf = (t: string): string[] =>
  t.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

/**
 * Lint one composer text box. kind:
 *  - "post": a standalone tweet draft (main tweet rules + split suggestion)
 *  - "hook": tweet #1 of a thread (main tweet rules + solo-line rule, no split)
 *  - "body": tweets 2+ of a thread (anything goes — links live here by design)
 */
export function reachLint(text: string, kind: ReachLintKind): ReachLintFinding[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (kind === "body") return [];

  const findings: ReachLintFinding[] = [];
  const paragraphs = paragraphsOf(trimmed);
  const mainParagraph = kind === "hook" ? trimmed : (paragraphs[0] ?? trimmed);

  if (URL_RE.test(mainParagraph)) {
    findings.push({
      code: "link_in_main",
      severity: "warn",
      message: "Link in the main tweet kills reach — move it to reply 1.",
    });
  }

  if (kind === "post" && (trimmed.length > MAIN_TWEET_MAX || paragraphs.length >= SPLIT_PARAGRAPHS)) {
    findings.push({
      code: "thread_split",
      severity: "warn",
      message: "Long post — split into a thread: first tweet is the hook line solo, beats follow one per tweet.",
    });
  }

  if (kind === "hook" && (paragraphs.length > 1 || trimmed.length > HOOK_SOLO_MAX)) {
    findings.push({
      code: "hook_not_solo",
      severity: "warn",
      message: "Hook should be one punchy line on its own — push the rest down-thread.",
    });
  }

  findings.push({
    code: "native_media",
    severity: "info",
    message: "Native image/video on the main tweet lifts reach — attach one if you have it.",
  });

  return findings;
}
