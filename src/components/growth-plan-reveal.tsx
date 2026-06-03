"use client";
import { type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BrandAvatar } from "@/components/ui/brand-avatar";
import type { GrowthPlan } from "@/lib/schemas";

function Section({ n, title, extra, children }: { n: string; title: string; extra?: string; children: ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-2.5 text-[12px] font-bold uppercase tracking-wide text-muted-foreground">
          {n} {title} {extra && <span className="font-semibold text-brand-text/60">· {extra}</span>}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

export function GrowthPlanReveal({ plan, onStart, ctaLabel = "Start engaging →" }: {
  plan: GrowthPlan;
  onStart?: () => void;
  ctaLabel?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <div className="mb-2 text-center">
        <div className="mb-2 text-4xl">🗺️</div>
        <span className="inline-block rounded-full bg-[color-mix(in_oklch,var(--primary)_14%,transparent)] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-text">{plan.archetypeLabel}</span>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Your Growth Plan</h1>
        <p className="text-sm text-muted-foreground">{plan.headline}</p>
      </div>

      <Section n="①" title="Your voice">
        <p className="text-[14px] italic leading-relaxed text-foreground">&ldquo;{plan.voiceSummary}&rdquo;</p>
        {plan.voiceTags.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {plan.voiceTags.map((t) => <span key={t} className="rounded-full bg-muted px-2.5 py-1 text-[12px] font-semibold text-muted-foreground">{t}</span>)}
          </div>
        )}
      </Section>

      <Section n="②" title="Your pillars & edge">
        {plan.pillars.length > 0 && <div className="text-[14px] font-bold">{plan.pillars.join(" · ")}</div>}
        <div className="mt-1 text-[13px] text-muted-foreground"><span className="font-semibold text-foreground">Your edge:</span> {plan.edge}</div>
      </Section>

      {plan.whoToWatch.length > 0 && (
        <Section n="③" title="Who to watch" extra={`${plan.whoToWatch.length} accounts`}>
          <div className="flex flex-col">
            {plan.whoToWatch.map((w) => (
              <div key={w.handle} className="flex items-center gap-2.5 border-b border-border py-2 last:border-none">
                <BrandAvatar name={w.handle} size="sm" />
                <div className="min-w-0">
                  <div className="text-[13.5px] font-semibold">{w.handle}</div>
                  <div className="text-[12px] text-muted-foreground">{w.why}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {plan.rhythm.length > 0 && (
        <Section n="④" title="Your rhythm">
          <div className="flex gap-2.5">
            {plan.rhythm.map((r) => (
              <div key={r.label} className="flex-1 rounded-xl bg-muted/60 px-2 py-3.5 text-center">
                <div className="text-xl font-bold text-brand-text">{r.count}</div>
                <div className="mt-0.5 text-[12px] text-muted-foreground">{r.label}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section n="⑤" title="Your north-star">
        <div className="flex items-center gap-3">
          <div className="text-xl font-bold">{plan.northStar.metric}</div>
          <div className="text-[13px] text-muted-foreground">{plan.northStar.detail}</div>
        </div>
      </Section>

      {plan.embalioDoes.length > 0 && (
        <Section n="⑥" title="What Embalio does for you">
          <ul className="space-y-1.5 text-[14px] leading-relaxed text-foreground">
            {plan.embalioDoes.map((d, i) => <li key={i}>· {d}</li>)}
          </ul>
        </Section>
      )}

      {plan.firstMoves.length > 0 && (
        <Section n="⑦" title="Your first moves">
          <ul className="space-y-1.5 text-[14px] leading-relaxed text-foreground">
            {plan.firstMoves.map((m, i) => <li key={i} className="text-brand-text">→ <span className="text-foreground">{m}</span></li>)}
          </ul>
        </Section>
      )}

      {onStart && <Button className="w-full" onClick={onStart}>{ctaLabel}</Button>}
    </div>
  );
}
