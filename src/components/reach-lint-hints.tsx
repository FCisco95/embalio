"use client";
import { reachLint, type ReachLintKind } from "@/lib/engagement/reach-lint";

/** Advisory pre-post checklist under a composer textarea. Never blocks. */
export function ReachLintHints({ text, kind }: { text: string; kind: ReachLintKind }) {
  const findings = reachLint(text, kind);
  if (findings.length === 0) return null;
  return (
    <ul className="space-y-0.5">
      {findings.map((f) => (
        <li
          key={f.code}
          className={`text-[11px] ${f.severity === "warn" ? "text-amber-500" : "text-muted-foreground"}`}
        >
          {f.severity === "warn" ? "⚠" : "💡"} {f.message}
        </li>
      ))}
    </ul>
  );
}
