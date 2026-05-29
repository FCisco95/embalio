"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Home,
  Target,
  PenLine,
  Reply,
  LineChart,
  User,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { BrandAvatar } from "@/components/ui/brand-avatar"

const NAV = [
  { href: "/",            icon: Home,      label: "Home"        },
  { href: "/board",       icon: Target,    label: "Board"       },
  { href: "/compose",     icon: PenLine,   label: "Compose"     },
  { href: "/engage",      icon: Reply,     label: "Engage"      },
  { href: "/performance", icon: LineChart, label: "Performance" },
  { href: "/profiles",    icon: User,      label: "Voice"       },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex flex-col w-[236px] shrink-0 h-screen sticky top-0 border-r border-border bg-card z-20">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-[60px] border-b border-border shrink-0">
        <div className="size-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <Zap className="size-[14px] text-primary-foreground" strokeWidth={1.6} />
        </div>
        <span className="font-semibold text-[14px] tracking-tight">dispatchAI</span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-[3px] px-3 py-3 flex-1 overflow-y-auto">
        {NAV.map(({ href, icon: Icon, label }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex items-center gap-3 rounded-lg px-3 py-[9px] text-[13.5px] font-medium transition-colors duration-[120ms]",
                isActive
                  ? "nav-active-bar font-semibold text-brand-text"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
              style={isActive ? { background: "color-mix(in oklch, var(--primary) 14%, transparent)" } : undefined}
            >
              <Icon className="size-4 shrink-0" strokeWidth={1.6} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Brand chip footer */}
      <div className="border-t border-border p-3 shrink-0">
        <div className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 bg-secondary">
          <BrandAvatar name="fcisco95" size="sm" />
          <div className="flex flex-col min-w-0">
            <span className="text-[12.5px] font-semibold truncate">fcisco95</span>
            <span className="text-[11px] text-muted-foreground truncate">@fcisco95</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
