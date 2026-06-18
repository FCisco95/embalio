import type { BreakoutPrecheck } from "@/lib/predict/schemas";

const BAND: Record<BreakoutPrecheck["band"], string> = {
  strong: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  weak: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
};

/** 0-100 breakout pre-check chip + verdict + fixes. */
export function BreakoutChip({ precheck }: { precheck: BreakoutPrecheck }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-medium ${BAND[precheck.band]}`}>
          Breakout {precheck.score}/100
        </span>
        <span className="text-[12px] text-muted-foreground">{precheck.verdict}</span>
      </div>
      {precheck.fixes.length > 0 && (
        <ul className="list-disc pl-5 text-[12px] text-muted-foreground">
          {precheck.fixes.map((f, i) => <li key={i}>{f}</li>)}
        </ul>
      )}
    </div>
  );
}
