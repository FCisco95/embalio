"use client"

import { useState } from "react"
import { Sidebar } from "./sidebar"
import { Topbar } from "./topbar"
import { BottomNav } from "./bottom-nav"
import type { SwitcherProfile } from "./account-switcher"

interface AppShellProps {
  children: React.ReactNode
  /** Nav badge counts keyed by href, e.g. { "/compose": 3 }. */
  badges?: Partial<Record<string, number>>
  /** Every profile the signed-in user owns, and which one is active. */
  profiles: SwitcherProfile[]
  activeId: string
}

export function AppShell({ children, badges, profiles, activeId }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="grid h-screen overflow-hidden bg-background max-md:block" style={{ gridTemplateColumns: "auto 1fr" }}>
      <Sidebar collapsed={collapsed} badges={badges} profiles={profiles} activeId={activeId} />
      <div className="flex min-w-0 flex-col overflow-hidden max-md:h-screen">
        <Topbar onToggleSidebar={() => setCollapsed((v) => !v)} profiles={profiles} activeId={activeId} />
        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden max-md:pb-20">{children}</main>
      </div>
      <BottomNav />
    </div>
  )
}
