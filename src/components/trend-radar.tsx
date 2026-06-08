"use client";
import { useState } from "react";
import { gatedTrendRadar, draftFromTrend } from "@/server/trends";
import type { GatedTrend } from "@/server/credibility";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { StyledSelect } from "@/components/ui/select-native";
import { toast } from "sonner";
import { safeHref } from "@/lib/safe-url";

export function TrendRadarPanel({ profiles }: { profiles: { id: string; handle: string }[] }) {
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? "");
  const [options, setOptions] = useState<GatedTrend[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [drafting, setDrafting] = useState<number | null>(null);

  async function run() {
    setBusy(true);
    try {
      const result = await gatedTrendRadar(profileId);
      setOptions(result);
      if (result.length === 0) {
        toast("No on-niche trends today — nothing worth spending reach on.");
      }
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function draft(idx: number, gated: GatedTrend) {
    setDrafting(idx);
    try {
      await draftFromTrend(profileId, gated);
      toast.success("Drafted — in your sign-off queue", {
        action: { label: "Open composer", onClick: () => { window.location.href = "/compose"; } },
      });
    } catch (e) { toast.error(String(e)); }
    finally { setDrafting(null); }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-3 flex-wrap">
        <StyledSelect
          aria-label="Profile"
          value={profileId}
          onChange={(e) => setProfileId(e.target.value)}
        >
          {profiles.map((p) => <option key={p.id} value={p.id}>{p.handle}</option>)}
        </StyledSelect>
        <Button disabled={busy || !profileId} onClick={run}>
          {busy ? "Scanning trends…" : "Scan niche trends"}
        </Button>
        {profiles.length === 0 && (
          <p className="text-sm text-destructive">No profiles found. Create a profile first.</p>
        )}
      </div>

      {options && (
        <div className="space-y-3">
          <p className="text-[13px] text-muted-foreground">{options.length} on-niche option{options.length === 1 ? "" : "s"}</p>
          {options.map((gated, i) => (
            <Card key={i}>
              <CardContent className="flex flex-col gap-2 pt-5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-[14px]">{gated.trend.topic}</span>
                  <Badge variant="accent">trending</Badge>
                </div>
                <p className="text-[13px]">
                  <span className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Why now: </span>
                  {gated.trend.why_now}
                </p>
                <p className="text-[13.5px]">
                  <span className="text-muted-foreground font-medium">Your angle: </span>
                  {gated.angle}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  <span className="font-medium">Why you: </span>
                  {gated.reason}
                </p>
                {gated.trend.source && (
                  <a href={safeHref(gated.trend.source)} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-text underline underline-offset-2">
                    source →
                  </a>
                )}
                <div>
                  <Button size="sm" disabled={drafting === i} onClick={() => draft(i, gated)}>
                    {drafting === i ? "Drafting…" : "Draft this"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
