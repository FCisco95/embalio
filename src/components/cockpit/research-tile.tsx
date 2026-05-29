"use client"

import { useState } from "react"
import { Search, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { Briefing } from "@/server/briefing"

interface ResearchTileProps {
  initialBriefing: Briefing | null
  onRun: () => Promise<{ ok: boolean; briefing?: Briefing; error?: string }>
}

export function ResearchTile({ initialBriefing, onRun }: ResearchTileProps) {
  const [briefing, setBriefing] = useState<Briefing | null>(initialBriefing)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRun() {
    setRunning(true)
    setError(null)
    const res = await onRun()
    if (res.ok && res.briefing) {
      setBriefing(res.briefing)
    } else {
      setError(res.error ?? "Unknown error")
    }
    setRunning(false)
  }

  const hoursAgo = briefing
    ? Math.round((Date.now() - new Date(briefing.created_at).getTime()) / 3_600_000)
    : null

  return (
    <div className="card-interactive flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-2">
        <span className="text-2xl leading-none" role="img" aria-label="Research">🔍</span>
        {briefing ? (
          <Badge variant="good">
            {hoursAgo === 0 ? "Just now" : `${hoursAgo}h ago`}
          </Badge>
        ) : (
          <Badge variant="warn">Not run</Badge>
        )}
      </div>

      <div className="flex flex-col gap-1.5 flex-1">
        <h3 className="text-[14px] font-semibold leading-snug">Research the week</h3>
        {briefing ? (
          <p className="text-[13px] text-muted-foreground leading-relaxed line-clamp-3">
            {briefing.summary}
          </p>
        ) : (
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            Scan trends, news, and your pillars — one briefing that powers all other tiles.
          </p>
        )}
        {error && (
          <p className="text-[12px] text-destructive mt-1">{error}</p>
        )}
      </div>

      <Button
        variant={briefing ? "outline" : "default"}
        size="sm"
        className="w-full gap-2"
        onClick={handleRun}
        disabled={running}
      >
        {running ? (
          <>
            <RefreshCw className="size-3.5 animate-spin" strokeWidth={1.6} />
            Researching…
          </>
        ) : (
          <>
            <Search className="size-3.5" strokeWidth={1.6} />
            {briefing ? "Re-run research" : "Research now"}
          </>
        )}
      </Button>
    </div>
  )
}
