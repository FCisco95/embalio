"use client"

import { useState } from "react"
import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { BrandAvatar } from "@/components/ui/brand-avatar"
import { SkeletonLine } from "@/components/ui/skeleton"
import type { Briefing } from "@/server/briefing"

interface ResearchTileProps {
  initialBriefing: Briefing | null
  onRun: () => Promise<{ ok: boolean; briefing?: Briefing; error?: string }>
}

export function ResearchTile({ initialBriefing, onRun }: ResearchTileProps) {
  const [briefing, setBriefing] = useState(initialBriefing)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setBusy(true)
    setError(null)
    const result = await onRun()
    if (result.ok && result.briefing) {
      setBriefing(result.briefing)
    } else {
      setError(result.error ?? "Something went wrong")
    }
    setBusy(false)
  }

  return (
    <Card interactive>
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="flex items-start justify-between gap-2">
          <BrandAvatar name="Research" size="sm" />
          <Sparkles className="size-4 text-muted-foreground" strokeWidth={1.6} />
        </div>

        <div className="flex flex-col gap-1.5 flex-1">
          <h3 className="text-[14px] font-semibold leading-snug">Weekly research</h3>

          {busy && (
            <div className="flex flex-col gap-2 mt-1">
              <SkeletonLine />
              <SkeletonLine className="w-4/5" />
              <SkeletonLine className="w-3/5" />
            </div>
          )}

          {!busy && briefing && (
            <p className="text-[13px] text-muted-foreground leading-relaxed line-clamp-3">
              {briefing.summary}
            </p>
          )}

          {!busy && !briefing && (
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              Run your weekly intelligence briefing to seed post generation.
            </p>
          )}

          {error && (
            <p className="text-[12px] text-destructive mt-1">{error}</p>
          )}
        </div>

        <Button
          variant="accentSoft"
          size="sm"
          className="w-full"
          onClick={run}
          disabled={busy}
        >
          {busy ? "Researching…" : briefing ? "Refresh briefing" : "Run briefing"}
        </Button>
      </CardContent>
    </Card>
  )
}
