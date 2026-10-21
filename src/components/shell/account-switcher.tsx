"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { ChevronDown, Check, Users } from "lucide-react"
import { BrandAvatar } from "@/components/ui/brand-avatar"
import { cn } from "@/lib/utils"
import { setActiveProfile } from "@/server/active-profile-actions"

export interface SwitcherProfile {
  id: string
  handle: string
  display_name: string | null
}

interface AccountSwitcherProps {
  /** Every profile the signed-in user owns (from the layout; nothing is fetched here). */
  profiles: SwitcherProfile[]
  activeId: string
  /** Which way the list opens: below the topbar trigger, or above the sidebar footer. */
  placement?: "down" | "up"
  /** Sidebar rail mode: avatar only. */
  compact?: boolean
}

const atHandle = (handle: string) => `@${handle.replace(/^@/, "")}`

export function AccountSwitcher({ profiles, activeId, placement = "down", compact = false }: AccountSwitcherProps) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState(false)
  const [pending, startTransition] = useTransition()
  const ref = useRef<HTMLDivElement>(null)
  const active = profiles.find((p) => p.id === activeId) ?? profiles[0]

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [])

  if (!active) return null

  const choose = (id: string) => {
    setOpen(false)
    if (id === active.id) return
    setError(false)
    // The action sets the cookie; Next re-renders the page and layouts with it.
    startTransition(async () => {
      try {
        await setActiveProfile(id)
      } catch {
        setError(true)
      }
    })
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={`Conta ativa: ${atHandle(active.handle)}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-busy={pending}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2.5 rounded-xl border border-border bg-surface-2 py-1.5 pl-[7px] pr-2.5 transition-colors hover:[border-color:color-mix(in_oklch,var(--primary)_40%,var(--border))]",
          compact && "px-[7px]",
          pending && "opacity-60",
        )}
      >
        <BrandAvatar name={active.handle} size={30} initials={active.handle.replace(/^@/, "")[0]?.toUpperCase()} />
        {!compact && (
          <>
            <div className="min-w-0 text-left">
              <div className="text-[13.5px] font-semibold leading-tight">{atHandle(active.handle)}</div>
              {active.display_name && (
                <div className="max-w-[150px] truncate text-[11px] leading-tight text-muted-foreground">
                  {active.display_name}
                </div>
              )}
            </div>
            <ChevronDown className="size-4 text-muted-foreground" strokeWidth={1.6} />
          </>
        )}
      </button>

      {error && !open && (
        <p
          role="alert"
          className={cn(
            "absolute left-0 z-50 w-max max-w-[260px] rounded-lg border border-border bg-popover px-2.5 py-1.5 text-[12px] text-destructive shadow-elev",
            placement === "up" ? "bottom-[calc(100%+8px)]" : "top-[calc(100%+8px)]",
          )}
        >
          Não foi possível trocar de conta. Tente de novo.
        </p>
      )}

      {open && (
        <div
          className={cn(
            "dx-pop absolute left-0 z-50 w-[290px] rounded-2xl border border-border bg-popover p-2 shadow-elev",
            placement === "up" ? "bottom-[calc(100%+8px)]" : "top-[calc(100%+8px)]",
          )}
        >
          <div className="px-2.5 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            Trocar conta
          </div>
          <div role="listbox" aria-label="Contas">
            {profiles.map((p) => {
              const isActive = p.id === active.id
              return (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => choose(p.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-secondary",
                    isActive && "[background:color-mix(in_oklch,var(--primary)_12%,transparent)]",
                  )}
                >
                  <BrandAvatar name={p.handle} size={36} initials={p.handle.replace(/^@/, "")[0]?.toUpperCase()} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold">{atHandle(p.handle)}</div>
                    {p.display_name && (
                      <div className="truncate text-[11.5px] text-muted-foreground">{p.display_name}</div>
                    )}
                  </div>
                  {isActive && <Check className="ml-1 size-4 text-brand-text" strokeWidth={1.6} />}
                </button>
              )
            })}
          </div>
          <div className="mt-1.5 border-t border-border pt-1.5">
            <Link
              href="/profiles"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-muted-foreground transition-colors hover:bg-secondary"
            >
              <span className="flex w-9 justify-center">
                <Users className="size-[18px]" strokeWidth={1.6} />
              </span>
              <span className="text-[13px] font-semibold">Gerir contas</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
