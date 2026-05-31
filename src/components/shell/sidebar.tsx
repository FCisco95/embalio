"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Home,
  Target,
  PenLine,
  Reply,
  LineChart,
  Settings2,
  Send,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { BrandAvatar, BRAND_GRADIENT } from "@/components/ui/brand-avatar"
import { BRAND } from "@/lib/brand"

const NAV = [
  { href: "/",            icon: Home,      label: "Home"        },
  { href: "/compose",     icon: PenLine,   label: "Composer"    },
  { href: "/board",       icon: Target,    label: "Targeting"   },
  { href: "/engage",      icon: Reply,     label: "Engage"      },
  { href: "/performance", icon: LineChart, label: "Reach"       },
  { href: "/profiles",    icon: Settings2, label: "Brand Voice" },
]

interface SidebarProps {
  collapsed?: boolean
  badges?: Partial<Record<string, number>>
}

export function Sidebar({ collapsed = false, badges }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        "flex h-screen shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-[180ms] ease-out",
        collapsed ? "w-[68px]" : "w-[236px]"
      )}
    >
      {/* Logo */}
      <div className={cn("flex items-center gap-2.5 pb-[18px] pt-5", collapsed ? "justify-center px-2.5" : "px-4")}>
        <div
          className="flex size-[30px] shrink-0 items-center justify-center rounded-[9px] bg-primary shadow-glow"
        >
          <Send className="size-[17px] text-primary-foreground" strokeWidth={1.6} />
        </div>
        {!collapsed && (
          <span className="text-[17px] font-bold tracking-[-0.02em]">Embalio</span>
        )}
      </div>

      {/* Nav */}
      <nav className={cn("flex flex-1 flex-col gap-[3px] overflow-y-auto", collapsed ? "px-2.5" : "px-3")}>
        {NAV.map(({ href, icon: Icon, label }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href)
          const badge = badges?.[href]
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                "relative flex items-center gap-[11px] rounded-[10px] px-[11px] py-[9px] text-[13.5px] font-medium transition-colors duration-[120ms]",
                collapsed && "justify-center",
                isActive
                  ? "nav-active-bar font-semibold text-brand-text"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
              style={isActive ? { background: "color-mix(in oklch, var(--primary) 14%, transparent)" } : undefined}
            >
              <span className="flex w-5 shrink-0 items-center justify-center">
                <Icon className="size-[18px]" strokeWidth={1.6} />
              </span>
              {!collapsed && <span className="flex-1 text-left">{label}</span>}
              {!collapsed && badge ? (
                <span className="inline-flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-primary px-[5px] text-[11px] font-bold text-primary-foreground">
                  {badge}
                </span>
              ) : null}
              {collapsed && badge ? (
                <span className="absolute right-[14px] top-2 size-1.5 rounded-full bg-primary" />
              ) : null}
            </Link>
          )
        })}
      </nav>

      {/* Brand chip footer */}
      <div className={cn("border-t border-border", collapsed ? "px-2.5 py-3" : "p-4")}>
        <div className={cn("flex items-center gap-2.5", collapsed && "justify-center")}>
          <BrandAvatar name={BRAND.name} size={30} gradient={BRAND_GRADIENT} initials="C" />
          {!collapsed && (
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-[12.5px] font-semibold">{BRAND.handle}</span>
              <span className="text-[11px] text-muted-foreground">{BRAND.plan}</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
