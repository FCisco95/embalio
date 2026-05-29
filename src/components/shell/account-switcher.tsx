"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronDown, Check, Plus } from "lucide-react"
import { BrandAvatar, BRAND_GRADIENT } from "@/components/ui/brand-avatar"
import { PlatformGlyph } from "@/components/ui/platform-glyph"
import { BRAND } from "@/lib/brand"

export function AccountSwitcher() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 rounded-xl border border-border bg-surface-2 py-1.5 pl-[7px] pr-2.5 transition-colors hover:[border-color:color-mix(in_oklch,var(--primary)_40%,var(--border))]"
      >
        <BrandAvatar name={BRAND.name} size={30} gradient={BRAND_GRADIENT} initials="C" />
        <div className="min-w-0 text-left">
          <div className="text-[13.5px] font-semibold leading-tight">{BRAND.handle}</div>
          <div className="max-w-[150px] truncate text-[11px] leading-tight text-muted-foreground">
            {BRAND.tagline}
          </div>
        </div>
        <ChevronDown className="size-4 text-muted-foreground" strokeWidth={1.6} />
      </button>

      {open && (
        <div className="dx-pop absolute left-0 top-[calc(100%+8px)] z-50 w-[290px] rounded-2xl border border-border bg-popover p-2 shadow-elev">
          <div className="px-2.5 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            Switch brand
          </div>
          <button className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left [background:color-mix(in_oklch,var(--primary)_12%,transparent)]">
            <BrandAvatar name={BRAND.name} size={36} gradient={BRAND_GRADIENT} initials="C" />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold">{BRAND.handle}</div>
              <div className="truncate text-[11.5px] text-muted-foreground">{BRAND.tagline}</div>
            </div>
            <div className="flex gap-px">
              {BRAND.platforms.slice(0, 4).map((p) => (
                <PlatformGlyph key={p} id={p} size={15} />
              ))}
            </div>
            <Check className="ml-1 size-4 text-brand-text" strokeWidth={1.6} />
          </button>
          <div className="mt-1.5 border-t border-border pt-1.5">
            <button className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-muted-foreground transition-colors hover:bg-secondary">
              <span className="flex w-9 justify-center">
                <Plus className="size-[18px]" strokeWidth={1.6} />
              </span>
              <span className="text-[13px] font-semibold">Connect a new brand</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
