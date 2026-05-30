"use client"

import { Search, Bell, PanelLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AccountSwitcher } from "./account-switcher"
import { PlatformTabs } from "./platform-tabs"
import { ThemeToggle } from "./theme-toggle"

interface TopbarProps {
  onToggleSidebar: () => void
}

export function Topbar({ onToggleSidebar }: TopbarProps) {
  return (
    <header
      className="sticky top-0 z-30 flex h-[60px] shrink-0 items-center justify-between gap-3.5 border-b border-border px-[18px]"
      style={{
        background: "var(--sidebar)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div className="flex min-w-0 items-center gap-3.5">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle sidebar"
          onClick={onToggleSidebar}
        >
          <PanelLeft className="size-[17px]" strokeWidth={1.6} />
        </Button>
        <AccountSwitcher />
        <div className="hidden h-[26px] w-px bg-border md:block" />
        <div className="hidden md:block">
          <PlatformTabs />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <label className="hidden w-[230px] items-center gap-2 rounded-[10px] border border-border bg-surface-2 px-[11px] py-[7px] text-muted-foreground sm:flex">
          <Search className="size-[15px]" strokeWidth={1.6} />
          <input
            placeholder="Search or jump to…"
            spellCheck={false}
            className="min-w-0 flex-1 border-none bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded-[5px] border border-border bg-background px-[5px] py-px text-[10.5px] text-muted-foreground">
            ⌘K
          </kbd>
        </label>
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="size-4" strokeWidth={1.6} />
        </Button>
        <ThemeToggle />
      </div>
    </header>
  )
}
