"use client";
import { useState, useEffect, useTransition } from "react";
import { getStrategyBoard } from "@/server/strategy";
import { StyledSelect } from "@/components/ui/select-native";
import { StrategyCard } from "./strategy-card";

interface StrategyBoardProps {
  profiles: { id: string; handle: string }[];
}

export function StrategyBoard({ profiles }: StrategyBoardProps) {
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? "");
  const [result, setResult] = useState<Awaited<ReturnType<typeof getStrategyBoard>> | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!profileId) return;
    let cancelled = false;
    startTransition(async () => {
      try {
        const res = await getStrategyBoard(profileId);
        if (!cancelled) setResult(res);
      } catch {
        if (!cancelled) setResult(null);
      }
    });
    return () => { cancelled = true; };
  }, [profileId]);

  return (
    <div className="space-y-4 max-w-2xl">
      {profiles.length > 1 && (
        <StyledSelect
          aria-label="Profile"
          value={profileId}
          onChange={(e) => setProfileId(e.target.value)}
        >
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>{p.handle}</option>
          ))}
        </StyledSelect>
      )}

      {isPending && (
        <p className="text-[13px] text-muted-foreground">Loading strategy…</p>
      )}

      {!isPending && result && (
        <>
          {result.ok && result.snapshot ? (
            <StrategyCard snapshot={result.snapshot} profileId={profileId} />
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-[13px] text-muted-foreground">
                No strategy snapshot yet — the weekly run will generate one.
              </p>
            </div>
          )}
        </>
      )}

      {profiles.length === 0 && (
        <p className="text-sm text-destructive">No profiles found. Create a profile first.</p>
      )}
    </div>
  );
}
