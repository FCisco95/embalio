import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Circle } from "lucide-react";
import type { DailyPlanView } from "@/server/daily-plan";

/** The home card: one ordered checklist for today. Read-only; each row links out. */
export function DailyPlanCard({ plan }: { plan: DailyPlanView }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-5">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          Today&apos;s plan
        </span>
        <ol className="flex flex-col gap-2.5">
          {plan.items.map((item) => (
            <li key={item.kind} className="flex items-start gap-2.5">
              {item.done ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={1.8} />
              ) : (
                <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
              )}
              <div className="min-w-0 flex-1">
                <p className={`text-[13.5px] font-medium ${item.done ? "line-through text-muted-foreground" : ""}`}>
                  {item.title}
                </p>
                {item.detail && (
                  <p className="text-[12.5px] leading-snug text-muted-foreground">{item.detail}</p>
                )}
              </div>
              {!item.done && (
                <Link
                  href={item.href}
                  className="shrink-0 rounded-md border border-border px-2 py-1 text-[11.5px] font-medium text-muted-foreground hover:text-foreground"
                >
                  {item.cta}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
