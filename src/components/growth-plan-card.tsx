import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import type { GrowthPlan } from "@/lib/schemas";

export function GrowthPlanCard({ plan }: { plan: GrowthPlan }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-5">
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-[color-mix(in_oklch,var(--primary)_14%,transparent)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-text">{plan.archetypeLabel}</span>
          <Link href="/plan" className={buttonVariants({ size: "sm", variant: "outline" })}>View plan</Link>
        </div>
        <div className="text-[13.5px] font-semibold">North-star: {plan.northStar.metric}</div>
        {plan.firstMoves.length > 0 && (
          <ul className="space-y-1 text-[13px] text-muted-foreground">
            {plan.firstMoves.slice(0, 3).map((m, i) => <li key={i} className="text-brand-text">→ <span className="text-foreground">{m}</span></li>)}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
