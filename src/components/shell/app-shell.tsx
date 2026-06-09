"use client"

import { useState } from "react"
import { Sidebar } from "./sidebar"
import { Topbar } from "./topbar"
import { BottomNav } from "./bottom-nav"

interface AppShellProps {
  children: React.ReactNode
  /** Nav badge counts keyed by href, e.g. { "/compose": 3 }. */
  badges?: Partial<Record<string, number>>
}

export function AppShell({ children, badges }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="grid h-screen overflow-hidden bg-background max-md:block" style={{ gridTemplateColumns: "auto 1fr" }}>
      <Sidebar collapsed={collapsed} badges={badges} />
      <div className="flex min-w-0 flex-col overflow-hidden max-md:h-screen">
        <Topbar onToggleSidebar={() => setCollapsed((v) => !v)} />
        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden max-md:pb-20">{children}</main>
      </div>
      <BottomNav />
    </div>
  )
}
