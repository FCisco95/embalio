"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { PlatformGlyph } from "@/components/ui/platform-glyph"
import { BRAND, PLATFORMS } from "@/lib/brand"
import { cn } from "@/lib/utils"

/**
 * Presentational platform tab row. Mirrors the Dispatch prototype: the live
 * platform is selected by default; others switch the visual context.
 */
export function PlatformTabs() {
  const [active, setActive] = useState(BRAND.livePlatform)

  return (
    <div className="flex items-center gap-1">
      {BRAND.platforms.map((p) => {
        const meta = PLATFORMS[p]
        const isActive = active === p
        return (
          <button
            key={p}
            onClick={() => setActive(p)}
            title={p === BRAND.livePlatform ? `${meta.name} · connected` : meta.name}
            className={cn(
              "flex items-center gap-[7px] rounded-[9px] border px-3 py-[7px] transition-all",
              isActive
                ? "border-border bg-surface-2 text-foreground"
                : "border-transparent text-muted-foreground hover:bg-surface-2 hover:text-foreground"
            )}
          >
            <PlatformGlyph id={p} size={16} muted={!isActive} />
            <span className="text-[12.5px] font-semibold">{meta.name}</span>
          </button>
        )
      })}
      <button
        title="Connect platform"
        className="rounded-[9px] border border-transparent p-[7px] text-muted-foreground transition-all hover:bg-surface-2 hover:text-foreground"
      >
        <Plus className="size-[15px]" strokeWidth={1.6} />
      </button>
    </div>
  )
}
