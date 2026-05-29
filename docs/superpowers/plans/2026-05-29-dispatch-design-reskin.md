# Dispatch Design System Reskin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the full Dispatch visual design system to dispatchAI, remove auth for local-only mode, and build the 6-tile home cockpit at `/`.

**Architecture:** Thin reskin + briefing cache (Approach A). All existing server logic is kept. Only the UI layer is replaced. Auth middleware is removed; all app DB reads switch to the service-role Supabase client against the fixed profile `fcisco95` (`FIXED_PROFILE_ID` env var). Home at `/` becomes the cockpit grid; existing routes (/board, /compose, /engage, /performance, /profiles) remain.

**Tech Stack:** Next.js 16 (App Router), Tailwind v4 (CSS-only config in globals.css, NO tailwind.config.ts), @base-ui/react (Button/Badge), shadcn/ui nova style, lucide-react (strokeWidth 1.6 globally), next-themes, Supabase service-role client, Vitest.

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Modify | `src/app/globals.css` | Full Dispatch token palette + @theme block |
| Modify | `src/app/layout.tsx` | Remove Geist fonts, add ThemeProvider dark default |
| Modify | `src/components/ui/button.tsx` | Add `accentSoft` variant; `default` gets glow shadow |
| Modify | `src/components/ui/badge.tsx` | Add `good`/`warn`/`bad`/`accent` tone variants |
| Modify | `src/components/ui/card.tsx` | Add `interactive` data-variant for hover lift |
| Create | `src/components/shell/sidebar.tsx` | Sidebar: logo + nav items + brand chip footer |
| Create | `src/components/shell/topbar.tsx` | 60px sticky topbar with blur glass effect |
| Create | `src/components/shell/page-shell.tsx` | Page content wrapper (topbar + scrollable main) |
| Modify | `src/app/(app)/layout.tsx` | Replace plain nav with `<Sidebar>` + flex frame |
| Modify | `src/middleware.ts` | Remove auth redirect; allow all routes |
| Modify | `src/lib/supabase/server.ts` | Export `supabaseApp()` alias for service-role use in pages |
| Modify | `src/server/profiles.ts` | Switch to `supabaseService()`; filter to fixed profile |
| Create | `supabase/migrations/20260529_research_briefings.sql` | New table for briefing cache |
| Create | `src/server/briefing.ts` | `getWeeklyBriefing()` + `runWeeklyBriefing()` with cache |
| Create | `src/server/briefing.test.ts` | Unit tests for briefing cache logic |
| Create | `src/components/cockpit/cockpit-tile.tsx` | Base tile component (nav tiles) |
| Create | `src/components/cockpit/research-tile.tsx` | Research tile (action tile with status) |
| Modify | `src/app/page.tsx` | Replace boilerplate with 6-tile cockpit grid |
| Delete | `src/app/login/page.tsx` | Auth removed — no longer needed |
| Delete | `src/app/api/auth/callback/route.ts` | Auth removed — no longer needed |

---

## Task 1: Design Tokens — globals.css

**Files:**
- Modify: `src/app/globals.css` (replace entirely)

The Dispatch palette uses hex values + `color-mix(in oklch, …)` for derived tints. Tailwind v4 reads tokens from `@theme inline`. No `tailwind.config.ts` needed.

- [ ] **Step 1: Replace globals.css**

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

/* ── Tailwind token bridge ─────────────────────────────────────── */
@theme inline {
  /* shadcn core */
  --color-background:        var(--background);
  --color-foreground:        var(--foreground);
  --color-card:              var(--card);
  --color-card-foreground:   var(--card-foreground);
  --color-popover:           var(--popover);
  --color-popover-foreground:var(--popover-foreground);
  --color-primary:           var(--primary);
  --color-primary-foreground:var(--primary-foreground);
  --color-secondary:         var(--secondary);
  --color-secondary-foreground:var(--secondary-foreground);
  --color-muted:             var(--muted);
  --color-muted-foreground:  var(--muted-foreground);
  --color-accent:            var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive:       var(--destructive);
  --color-border:            var(--border);
  --color-input:             var(--input);
  --color-ring:              var(--ring);
  /* sidebar */
  --color-sidebar:                    var(--sidebar);
  --color-sidebar-foreground:         var(--sidebar-foreground);
  --color-sidebar-primary:            var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent:             var(--sidebar-accent);
  --color-sidebar-accent-foreground:  var(--sidebar-accent-foreground);
  --color-sidebar-border:             var(--sidebar-border);
  --color-sidebar-ring:               var(--sidebar-ring);
  /* Dispatch extras */
  --color-success:      var(--success);
  --color-warning:      var(--warning);
  --color-brand-text:   var(--brand-text);
  --color-surface-2:    var(--surface-2);
  /* radius */
  --radius-sm: calc(var(--radius) - 6px);
  --radius-md: calc(var(--radius) - 4px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --radius-2xl: calc(var(--radius) + 8px);
  --radius-3xl: calc(var(--radius) + 12px);
  --radius-4xl: calc(var(--radius) + 16px);
  /* shadows */
  --shadow-elev: var(--shadow-elev);
  --shadow-glow: var(--glow);
  /* layout */
  --max-w-content: 1180px;
  /* typography */
  --font-sans: 'Segoe UI', system-ui, -apple-system, sans-serif;
  --font-mono: ui-monospace, 'SF Mono', Menlo, monospace;
}

/* ── Light theme ───────────────────────────────────────────────── */
:root {
  --background:          #f6f7f9;
  --foreground:          #14161c;
  --card:                #ffffff;
  --card-foreground:     #14161c;
  --popover:             #ffffff;
  --popover-foreground:  #14161c;
  --primary:             #6366f1;
  --primary-foreground:  #ffffff;
  --secondary:           #f0f1f4;
  --secondary-foreground:#14161c;
  --muted:               #f0f1f4;
  --muted-foreground:    #888d98;
  --accent:              #f0f1f4;
  --accent-foreground:   #14161c;
  --destructive:         #dc2626;
  --destructive-foreground: #ffffff;
  --success:             #059669;
  --warning:             #b45309;
  --border:              #e4e6ea;
  --input:               #e4e6ea;
  --ring:                #6366f1;
  --radius:              1rem;

  --brand-text:   color-mix(in oklch, var(--primary) 82%, black);
  --surface-2:    #f0f1f4;
  --shadow-elev:  0 12px 32px -16px rgba(20, 30, 60, 0.18);
  --glow:         0 0 22px -10px color-mix(in oklch, var(--primary) 55%, transparent);

  --sidebar:                    #ffffff;
  --sidebar-foreground:         #14161c;
  --sidebar-primary:            #6366f1;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent:             #f0f1f4;
  --sidebar-accent-foreground:  #14161c;
  --sidebar-border:             #e4e6ea;
  --sidebar-ring:               #6366f1;
}

/* ── Dark theme ────────────────────────────────────────────────── */
.dark {
  --background:          #08090d;
  --foreground:          #f0f1f5;
  --card:                #101119;
  --card-foreground:     #f0f1f5;
  --popover:             #101119;
  --popover-foreground:  #f0f1f5;
  --primary:             #6366f1;
  --primary-foreground:  #ffffff;
  --secondary:           #181a23;
  --secondary-foreground:#f0f1f5;
  --muted:               #181a23;
  --muted-foreground:    #7f828d;
  --accent:              #181a23;
  --accent-foreground:   #f0f1f5;
  --destructive:         #f87171;
  --destructive-foreground: #ffffff;
  --success:             #34d399;
  --warning:             #fbbf24;
  --border:              #24262f;
  --input:               #24262f;
  --ring:                #6366f1;

  --brand-text:   color-mix(in oklch, var(--primary) 70%, white);
  --surface-2:    #181a23;
  --shadow-elev:  0 12px 36px -14px rgba(0, 0, 0, 0.7);
  --glow:         0 0 26px -8px color-mix(in oklch, var(--primary) 75%, transparent);

  --sidebar:                    #101119;
  --sidebar-foreground:         #f0f1f5;
  --sidebar-primary:            #6366f1;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent:             #181a23;
  --sidebar-accent-foreground:  #f0f1f5;
  --sidebar-border:             #24262f;
  --sidebar-ring:               #6366f1;
}

/* ── Dispatch utility classes ──────────────────────────────────── */
@layer utilities {
  /* Selection color */
  ::selection {
    background: color-mix(in oklch, var(--primary) 35%, transparent);
  }

  /* Tabular numbers for data columns */
  .tabular { font-variant-numeric: tabular-nums; }

  /* Card hover lift (applied to interactive cards) */
  .card-interactive {
    transition: transform 0.14s ease, border-color 0.14s ease, box-shadow 0.14s ease;
    cursor: pointer;
  }
  .card-interactive:hover {
    transform: translateY(-2px);
    border-color: color-mix(in oklch, var(--primary) 35%, var(--border));
    box-shadow: var(--shadow-elev);
  }

  /* Active nav left-bar indicator */
  .nav-active-bar::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 3px;
    height: 18px;
    background: var(--primary);
    border-radius: 0 3px 3px 0;
  }
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
  html {
    @apply font-sans antialiased;
  }
}
```

- [ ] **Step 2: Verify tokens load (visual check)**

```bash
cd C:\Users\joao_\Desktop\projects\dispatchAI && npm run dev
```

Open http://localhost:3000 — background should be `#08090d` (very dark), text `#f0f1f5`. If the browser shows white background, the dark class is missing (fixed in Task 2).

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(design): apply Dispatch token palette and theme variables"
```

---

## Task 2: Root Layout — Remove Geist, Add ThemeProvider

**Files:**
- Modify: `src/app/layout.tsx`

Remove Google Fonts import (Geist), add `next-themes` ThemeProvider with `defaultTheme="dark"`.

- [ ] **Step 1: Update layout.tsx**

```tsx
import type { Metadata } from "next"
import { ThemeProvider } from "next-themes"
import "./globals.css"

export const metadata: Metadata = {
  title: "dispatchAI",
  description: "Your personal content cockpit",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full">
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Verify dark background in browser**

Reload http://localhost:3000 — should show very dark background (`#08090d`). No Google Fonts loading request in network tab.

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(design): remove Geist, add next-themes dark default"
```

---

## Task 3: Button Variants — accentSoft + Glow on Primary

**Files:**
- Modify: `src/components/ui/button.tsx`

Add `accentSoft` variant (accent@14% fill, brand-text color). Update `default` to include glow shadow and hover brightness.

- [ ] **Step 1: Update buttonVariants in button.tsx**

Replace the `variants.variant` object with:

```ts
variant: {
  default:
    "bg-primary text-primary-foreground shadow-glow hover:brightness-[1.06] active:translate-y-px",
  outline:
    "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
  secondary:
    "bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
  ghost:
    "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
  destructive:
    "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
  link: "text-primary underline-offset-4 hover:underline",
  accentSoft:
    "[background:color-mix(in_oklch,var(--primary)_14%,transparent)] text-brand-text [border-color:color-mix(in_oklch,var(--primary)_30%,transparent)] border hover:[background:color-mix(in_oklch,var(--primary)_20%,transparent)]",
},
```

Also update `VariantProps` type to include `accentSoft` — no change needed, cva handles it automatically.

- [ ] **Step 2: Add accentSoft to Button props type**

The function signature already accepts `VariantProps<typeof buttonVariants>` so `variant="accentSoft"` is automatically typed. No additional changes needed.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/button.tsx
git commit -m "feat(design): add accentSoft button variant and glow on primary"
```

---

## Task 4: Badge Tones — good / warn / bad / accent

**Files:**
- Modify: `src/components/ui/badge.tsx`

Add semantic tone variants for status pills. Each tone: fill `color@16%`, border `color@30%`, solid text color.

- [ ] **Step 1: Add tone variants to badgeVariants**

Add to the `variants.variant` object (keep existing variants, add at the end):

```ts
good:
  "[background:color-mix(in_oklch,var(--success)_16%,transparent)] [border-color:color-mix(in_oklch,var(--success)_30%,transparent)] border text-success",
warn:
  "[background:color-mix(in_oklch,var(--warning)_16%,transparent)] [border-color:color-mix(in_oklch,var(--warning)_30%,transparent)] border text-warning",
bad:
  "[background:color-mix(in_oklch,var(--destructive)_16%,transparent)] [border-color:color-mix(in_oklch,var(--destructive)_30%,transparent)] border text-destructive",
accent:
  "[background:color-mix(in_oklch,var(--primary)_16%,transparent)] [border-color:color-mix(in_oklch,var(--primary)_30%,transparent)] border text-brand-text",
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/badge.tsx
git commit -m "feat(design): add good/warn/bad/accent badge tone variants"
```

---

## Task 5: Card — Interactive Hover Variant

**Files:**
- Modify: `src/components/ui/card.tsx`

Add `interactive` variant using the `.card-interactive` utility class defined in globals.css. Also update base Card to match Dispatch border style (no ambient shadow at rest, 1px border).

- [ ] **Step 1: Update Card component**

Replace the `Card` function:

```tsx
function Card({
  className,
  size = "default",
  interactive = false,
  ...props
}: React.ComponentProps<"div"> & {
  size?: "default" | "sm"
  interactive?: boolean
}) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        "group/card flex flex-col gap-4 overflow-hidden rounded-xl bg-card border border-border py-4 text-sm text-card-foreground has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:gap-3 data-[size=sm]:py-3",
        interactive && "card-interactive",
        className
      )}
      {...props}
    />
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/card.tsx
git commit -m "feat(design): add interactive hover variant to Card"
```

---

## Task 6: Sidebar Component

**Files:**
- Create: `src/components/shell/sidebar.tsx`

Client component (needs `usePathname`). 236px wide. Logo block → nav list → brand chip footer. Active nav uses accent@14% bg + brand-text + 3px left bar.

- [ ] **Step 1: Create src/components/shell/ directory and sidebar.tsx**

```tsx
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
                  ? "nav-active-bar font-semibold text-brand-text [background:color-mix(in_oklch,var(--primary)_14%,transparent)]"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
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
          <div
            className="size-7 rounded-md flex items-center justify-center shrink-0 text-[11px] font-bold text-primary-foreground"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
          >
            F
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[12.5px] font-semibold truncate">fcisco95</span>
            <span className="text-[11px] text-muted-foreground truncate">@fcisco95</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/shell/sidebar.tsx
git commit -m "feat(shell): create Sidebar component with Dispatch nav design"
```

---

## Task 7: Topbar + PageShell

**Files:**
- Create: `src/components/shell/topbar.tsx`
- Create: `src/components/shell/page-shell.tsx`

Topbar is 60px sticky with glass-blur background. PageShell wraps each page's scrollable content.

- [ ] **Step 1: Create topbar.tsx**

```tsx
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"

interface TopbarProps {
  title: string
  actions?: React.ReactNode
}

export function Topbar({ title, actions }: TopbarProps) {
  return (
    <header
      className="sticky top-0 z-10 flex h-[60px] shrink-0 items-center gap-4 border-b border-border px-[18px]"
      style={{
        background: "color-mix(in oklch, var(--card) 75%, transparent)",
        backdropFilter: "blur(12px)",
      }}
    >
      <h1 className="flex-1 text-[15px] font-bold tracking-tight">{title}</h1>
      <div className="flex items-center gap-1">
        {actions}
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="size-4" strokeWidth={1.6} />
        </Button>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Create page-shell.tsx**

```tsx
import { Topbar } from "./topbar"

interface PageShellProps {
  title: string
  actions?: React.ReactNode
  children: React.ReactNode
  /** Set to false for pages that manage their own padding (e.g. full-bleed grids) */
  padded?: boolean
}

export function PageShell({
  title,
  actions,
  children,
  padded = true,
}: PageShellProps) {
  return (
    <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
      <Topbar title={title} actions={actions} />
      <main className="flex-1 overflow-y-auto">
        {padded ? (
          <div className="max-w-[1180px] mx-auto px-8 py-7 pb-16">{children}</div>
        ) : (
          children
        )}
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/shell/topbar.tsx src/components/shell/page-shell.tsx
git commit -m "feat(shell): create Topbar and PageShell components"
```

---

## Task 8: App Layout — Wire Shell

**Files:**
- Modify: `src/app/(app)/layout.tsx`

Replace the plain `<nav>` with the Sidebar + main column frame. Each child page will use `<PageShell>` for its topbar + content area.

- [ ] **Step 1: Replace (app)/layout.tsx**

```tsx
import { Sidebar } from "@/components/shell/sidebar"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update board/page.tsx to use PageShell**

Open `src/app/(app)/board/page.tsx`. Import PageShell and wrap content:

```tsx
import { PageShell } from "@/components/shell/page-shell"
import { listProfiles } from "@/server/profiles"
import { supabaseService } from "@/lib/supabase/server"
import { RefreshButton } from "@/components/refresh-button"
import { CandidateCard } from "@/components/candidate-card"

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ profile?: string }>
}) {
  const { profile } = await searchParams
  const profiles = (await listProfiles()) ?? []
  const active = profile ?? profiles[0]?.id

  const postingEnabled = process.env.NEXT_PUBLIC_POSTING_ENABLED === "true"
  let candidates: Record<string, unknown>[] = []
  if (active) {
    const sb = supabaseService()
    const { data } = await sb
      .from("candidates")
      .select("*, drafts(*)")
      .eq("profile_id", active)
      .eq("status", "surfaced")
      .order("score_composite", { ascending: false })
    candidates = (data as Record<string, unknown>[]) ?? []
  }

  return (
    <PageShell
      title="Targeting Board"
      actions={active ? <RefreshButton profileId={active} /> : undefined}
    >
      <div className="flex gap-2 text-sm mb-4">
        {profiles.map((p) => (
          <a
            key={p.id}
            href={`/board?profile=${p.id}`}
            className={p.id === active ? "font-semibold underline" : "underline"}
          >
            {p.handle}
          </a>
        ))}
      </div>
      <div className="grid gap-3">
        {candidates.map((c) => (
          <CandidateCard
            key={c.id as string}
            candidate={c}
            postingEnabled={postingEnabled}
          />
        ))}
        {candidates.length === 0 && (
          <p className="text-muted-foreground">No targets yet — hit Refresh.</p>
        )}
      </div>
    </PageShell>
  )
}
```

- [ ] **Step 3: Verify layout in browser**

Navigate to http://localhost:3000/board — should show the sidebar on the left with the Dispatch nav and the board content in the main column.

- [ ] **Step 4: Commit**

```bash
git add src/app/(app)/layout.tsx src/app/(app)/board/page.tsx
git commit -m "feat(shell): wire Sidebar into app layout; reskin board page"
```

---

## Task 9: Remove Auth Middleware

**Files:**
- Modify: `src/middleware.ts`

Strip the auth redirect entirely. Keep the `config.matcher` to ensure cron routes are still excluded from middleware processing (not that it matters without auth, but it avoids future confusion).

- [ ] **Step 1: Replace middleware.ts**

```ts
import { type NextRequest, NextResponse } from "next/server"

export function middleware(_req: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/cron/).*)"],
}
```

- [ ] **Step 2: Verify redirect is gone**

Visit http://localhost:3000/ in an incognito tab — should NOT redirect to `/login`. Should show (whatever is at `/`).

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat(auth): remove auth redirect middleware (local-only mode)"
```

---

## Task 10: Service-Role Client for App Routes

**Files:**
- Modify: `src/lib/supabase/server.ts`
- Modify: `src/server/profiles.ts`

Add `supabaseApp()` as a convenience alias for `supabaseService()`. Update `profiles.ts` to use it (remove auth dependency). The key change: `supabaseService()` is **synchronous** — drop the `await` when switching callers.

- [ ] **Step 1: Add supabaseApp export to server.ts**

Open `src/lib/supabase/server.ts`. At the bottom, add:

```ts
/** Convenience alias for service-role client — use in all app pages (local-only mode). */
export const supabaseApp = supabaseService
```

- [ ] **Step 2: Update profiles.ts**

Replace the entire file:

```ts
"use server"
import { supabaseService } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

const FIXED_PROFILE_ID = process.env.FIXED_PROFILE_ID

export async function createProfile(input: {
  handle: string
  display_name?: string
  niche_description?: string
  voice_corpus: string[]
  voice_notes?: string
}) {
  const sb = supabaseService()
  const { data, error } = await sb.from("profiles").insert(input).select().single()
  if (error) throw new Error(error.message)
  revalidatePath("/profiles")
  return data
}

export async function listProfiles() {
  const sb = supabaseService()
  let query = sb.from("profiles").select("*").order("created_at")
  if (FIXED_PROFILE_ID) {
    query = query.eq("id", FIXED_PROFILE_ID)
  }
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data
}

export async function addSeedTarget(input: {
  profile_id: string
  handle?: string
  list_url?: string
  note?: string
}) {
  const sb = supabaseService()
  const { error } = await sb.from("seed_targets").insert(input)
  if (error) throw new Error(error.message)
  revalidatePath("/profiles")
}

export async function listSeedTargets(profileId: string) {
  const sb = supabaseService()
  const { data, error } = await sb
    .from("seed_targets")
    .select("*")
    .eq("profile_id", profileId)
    .eq("active", true)
  if (error) throw new Error(error.message)
  return data
}
```

- [ ] **Step 3: Add FIXED_PROFILE_ID to .env.local**

Open `.env.local` and add:

```
FIXED_PROFILE_ID=7a728122-569a-4db0-8773-1e537fd1a92f
```

(This is the `fcisco95` profile id confirmed in the brainstorm notes.)

- [ ] **Step 4: Find other callers of supabaseServer() in app pages and update them**

Run:
```bash
grep -r "supabaseServer" src/app src/components --include="*.tsx" --include="*.ts" -l
```

For each file found: replace `await supabaseServer()` → `supabaseService()` (remove the `await`). The `supabaseService()` function is synchronous.

- [ ] **Step 5: Verify board page loads profile data**

Navigate to http://localhost:3000/board — should show the fcisco95 profile and any surfaced candidates without requiring login.

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase/server.ts src/server/profiles.ts .env.local
git commit -m "feat(auth): switch app routes to service-role client; pin to fixed profile"
```

---

## Task 11: Briefing Cache — DB Migration + Server Logic

**Files:**
- Create: `supabase/migrations/20260529_research_briefings.sql`
- Create: `src/server/briefing.ts`
- Create: `src/server/briefing.test.ts`

The `research_briefings` table caches one briefing per profile per day. `getWeeklyBriefing()` returns today's cached briefing or null. `runWeeklyBriefing()` runs-or-returns-cached.

- [ ] **Step 1: Write failing tests first**

Create `src/server/briefing.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"

// Each test gets a fresh module to reset mocks
const mockSingle = vi.fn()
const mockInsert = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()

const mockFrom = vi.fn(() => ({
  select: mockSelect.mockReturnThis(),
  eq: mockEq.mockReturnThis(),
  single: mockSingle,
  insert: mockInsert.mockReturnValue({
    select: mockSelect.mockReturnThis(),
    single: mockSingle,
  }),
}))

vi.mock("@/lib/supabase/server", () => ({
  supabaseService: () => ({ from: mockFrom }),
}))

vi.stubEnv("FIXED_PROFILE_ID", "test-profile-id")

beforeEach(() => {
  vi.resetModules()
  mockSingle.mockResolvedValue({ data: null, error: null })
})

describe("getWeeklyBriefing", () => {
  it("returns null when no row exists", async () => {
    mockSingle.mockResolvedValue({ data: null, error: null })
    const { getWeeklyBriefing } = await import("./briefing")
    const result = await getWeeklyBriefing("2026-05-29")
    expect(result).toBeNull()
  })

  it("returns cached briefing when row exists", async () => {
    const cached = {
      id: "abc",
      profile_id: "test-profile-id",
      date: "2026-05-29",
      summary: "Weekly summary",
      topics: ["AI", "Web3"],
      created_at: "2026-05-29T10:00:00Z",
    }
    mockSingle.mockResolvedValue({ data: cached, error: null })
    const { getWeeklyBriefing } = await import("./briefing")
    const result = await getWeeklyBriefing("2026-05-29")
    expect(result).toEqual(cached)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run src/server/briefing.test.ts
```

Expected: FAIL — "Cannot find module './briefing'"

- [ ] **Step 3: Create the DB migration**

Create `supabase/migrations/20260529_research_briefings.sql`:

```sql
-- Research briefings cache: one row per profile per day
create table if not exists public.research_briefings (
  id         uuid primary key default gen_random_uuid(),
  profile_id text not null,
  date       date not null,
  summary    text not null default '',
  topics     jsonb not null default '[]'::jsonb,
  raw_data   jsonb,
  created_at timestamptz not null default now(),
  constraint research_briefings_profile_date_key unique (profile_id, date)
);

-- No RLS needed (service-role only)
alter table public.research_briefings disable row level security;
```

Run this migration in your Supabase dashboard SQL editor.

- [ ] **Step 4: Create src/server/briefing.ts**

```ts
import { supabaseService } from "@/lib/supabase/server"

const PROFILE_ID = process.env.FIXED_PROFILE_ID!

export interface Briefing {
  id: string
  profile_id: string
  date: string
  summary: string
  topics: string[]
  raw_data?: unknown
  created_at: string
}

/** Return today's cached briefing, or null if it hasn't been run yet. */
export async function getWeeklyBriefing(date: string): Promise<Briefing | null> {
  const sb = supabaseService()
  const { data } = await sb
    .from("research_briefings")
    .select("*")
    .eq("profile_id", PROFILE_ID)
    .eq("date", date)
    .single()
  return (data as Briefing) ?? null
}

/**
 * Return today's cached briefing, or run research and cache a new one.
 * Idempotent — safe to call multiple times per day.
 */
export async function runWeeklyBriefing(date: string): Promise<Briefing> {
  const cached = await getWeeklyBriefing(date)
  if (cached) return cached

  // TODO: integrate with generateWeeklyPosts research phase (next sprint)
  // For now, store a placeholder so the cache machinery works end-to-end
  const summary = `Research briefing — ${date}. Full integration coming next.`
  const topics: string[] = []

  const sb = supabaseService()
  const { data, error } = await sb
    .from("research_briefings")
    .insert({ profile_id: PROFILE_ID, date, summary, topics })
    .select()
    .single()

  if (error) throw new Error(`Failed to store briefing: ${error.message}`)
  return data as Briefing
}
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
npx vitest run src/server/briefing.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260529_research_briefings.sql src/server/briefing.ts src/server/briefing.test.ts
git commit -m "feat(briefing): add research_briefings table and cache functions"
```

---

## Task 12: Cockpit Tile Components

**Files:**
- Create: `src/components/cockpit/cockpit-tile.tsx`
- Create: `src/components/cockpit/research-tile.tsx`

`CockpitTile` is a navigation tile (href + description + CTA). `ResearchTile` is the action tile — shows briefing status and a button to run research.

- [ ] **Step 1: Create cockpit-tile.tsx**

```tsx
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface CockpitTileProps {
  emoji: string
  title: string
  description: string
  href: string
  cta: string
  badgeLabel?: string
  badgeTone?: "good" | "warn" | "bad" | "accent"
}

export function CockpitTile({
  emoji,
  title,
  description,
  href,
  cta,
  badgeLabel,
  badgeTone = "accent",
}: CockpitTileProps) {
  return (
    <div className="card-interactive group flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-2">
        <span className="text-2xl leading-none" role="img">{emoji}</span>
        {badgeLabel && <Badge variant={badgeTone}>{badgeLabel}</Badge>}
      </div>
      <div className="flex flex-col gap-1.5 flex-1">
        <h3 className="text-[14px] font-semibold leading-snug">{title}</h3>
        <p className="text-[13px] text-muted-foreground leading-relaxed">{description}</p>
      </div>
      <Link href={href}>
        <Button variant="accentSoft" size="sm" className="w-full gap-2">
          {cta}
          <ArrowRight className="size-3.5" strokeWidth={1.6} />
        </Button>
      </Link>
    </div>
  )
}
```

- [ ] **Step 2: Create research-tile.tsx**

```tsx
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
        <span className="text-2xl leading-none" role="img">🔍</span>
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
```

- [ ] **Step 3: Commit**

```bash
git add src/components/cockpit/cockpit-tile.tsx src/components/cockpit/research-tile.tsx
git commit -m "feat(cockpit): create CockpitTile and ResearchTile components"
```

---

## Task 13: Home Page — 6-Tile Cockpit Grid

**Files:**
- Modify: `src/app/page.tsx`

Replace Next.js boilerplate with the cockpit grid. This is a server component that loads the today's briefing status, then passes it to `ResearchTile`. A server action handles the run trigger.

- [ ] **Step 1: Replace src/app/page.tsx**

```tsx
import { PageShell } from "@/components/shell/page-shell"
import { CockpitTile } from "@/components/cockpit/cockpit-tile"
import { ResearchTile } from "@/components/cockpit/research-tile"
import { getWeeklyBriefing, runWeeklyBriefing } from "@/server/briefing"

const TODAY = new Date().toISOString().split("T")[0]

const NAV_TILES = [
  {
    emoji: "💬",
    title: "Who to reply to",
    description: "Daily reply opportunities from seed accounts — drafted replies ready to copy.",
    href: "/engage",
    cta: "Open queue",
  },
  {
    emoji: "➕",
    title: "Who to follow",
    description: "Target accounts aligned with your pillars and audience growth.",
    href: "/board",
    cta: "View board",
  },
  {
    emoji: "✍️",
    title: "Generate posts",
    description: "3–5 weekly posts drafted from your briefing, voice-matched.",
    href: "/compose",
    cta: "Go compose",
  },
  {
    emoji: "🧵",
    title: "Draft a thread",
    description: "Turn a topic or briefing insight into a full Twitter thread.",
    href: "/compose?mode=thread",
    cta: "Draft thread",
  },
  {
    emoji: "🎙️",
    title: "Tune my voice",
    description: "Update your voice spec and content pillars.",
    href: "/profiles",
    cta: "Open profiles",
  },
]

async function runResearch() {
  "use server"
  try {
    const briefing = await runWeeklyBriefing(TODAY)
    return { ok: true, briefing }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

export default async function HomePage() {
  const briefing = await getWeeklyBriefing(TODAY)

  return (
    <PageShell title="Cockpit" padded={false}>
      <div className="max-w-[1180px] mx-auto px-8 py-8 pb-16">
        <div className="mb-8">
          <h2 className="text-2xl font-bold tracking-tight">Good morning</h2>
          <p className="text-muted-foreground text-sm mt-1">
            What do you want to do today?
          </p>
        </div>

        <div className="grid grid-cols-2 gap-[18px] lg:grid-cols-3">
          {/* Research tile — action tile, always first */}
          <ResearchTile initialBriefing={briefing} onRun={runResearch} />

          {/* Nav tiles */}
          {NAV_TILES.map((tile) => (
            <CockpitTile key={tile.href} {...tile} />
          ))}
        </div>
      </div>
    </PageShell>
  )
}
```

- [ ] **Step 2: Verify cockpit in browser**

Navigate to http://localhost:3000/ — should show 6 tiles in a 2-column grid (3-column on large screen). Research tile shows "Not run" badge. Clicking "Research now" should trigger the server action.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(cockpit): build 6-tile home cockpit grid"
```

---

## Task 14: Remove Dead Auth Files

**Files:**
- Delete: `src/app/login/page.tsx`
- Delete: `src/app/api/auth/callback/route.ts`

These files are unreachable now that middleware no longer redirects to `/login`.

- [ ] **Step 1: Delete auth files**

```bash
rm src/app/login/page.tsx
rm src/app/api/auth/callback/route.ts
# Remove empty directories if present
rmdir src/app/login 2>/dev/null || true
rmdir src/app/api/auth/callback 2>/dev/null || true
rmdir src/app/api/auth 2>/dev/null || true
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove login page and auth callback (local-only mode)"
```

---

## Task 15: Update Remaining App Pages to Use PageShell

**Files:**
- Modify: `src/app/(app)/compose/page.tsx`
- Modify: `src/app/(app)/engage/page.tsx`
- Modify: `src/app/(app)/performance/page.tsx`
- Modify: `src/app/(app)/profiles/page.tsx`

Each page needs to import `PageShell` and replace its top-level div + h1 with `<PageShell title="...">`. Also switch any `supabaseServer()` calls to `supabaseService()`.

- [ ] **Step 1: Read each page to understand its current structure**

```bash
cat src/app/(app)/compose/page.tsx
cat src/app/(app)/engage/page.tsx
cat src/app/(app)/performance/page.tsx
cat src/app/(app)/profiles/page.tsx
```

- [ ] **Step 2: For each page — pattern to apply**

The transformation follows the same pattern as board/page.tsx in Task 8:

1. Add import: `import { PageShell } from "@/components/shell/page-shell"`
2. Remove any `import { supabaseServer }` → replace with `import { supabaseService }` from same path
3. Replace `const sb = await supabaseServer()` → `const sb = supabaseService()`
4. Wrap JSX return in `<PageShell title="Page Title">...</PageShell>` instead of `<div className="p-6 space-y-4">...<h1>...</h1>`

- [ ] **Step 3: Verify all pages render without errors**

Visit each route in the browser:
- http://localhost:3000/compose
- http://localhost:3000/engage
- http://localhost:3000/performance
- http://localhost:3000/profiles

Each should show the sidebar + topbar with the correct title.

- [ ] **Step 4: Run test suite to verify no regressions**

```bash
npx vitest run
```

Expected: all existing tests pass.

- [ ] **Step 5: Final commit**

```bash
git add src/app/(app)/compose/page.tsx src/app/(app)/engage/page.tsx src/app/(app)/performance/page.tsx src/app/(app)/profiles/page.tsx
git commit -m "feat(shell): wrap remaining pages in PageShell; switch to service-role client"
```

---

## Self-Review

### Spec coverage check

| Spec requirement | Covered by |
|---|---|
| Design tokens (hex palette, dark/light) | Task 1 |
| shadcn CSS variable mapping | Task 1 |
| `color-mix(in oklch, …)` derived tints | Task 1 (utility classes + inline in components) |
| Segoe UI / system-ui font stack | Task 2 |
| Primary button glow + hover brightness | Task 3 |
| accentSoft button variant | Task 3 |
| good/warn/bad/accent badge tones | Task 4 |
| Card interactive hover lift | Task 5 |
| Sidebar (236px, logo, nav, brand chip) | Task 6 |
| Active nav left-bar indicator | Task 6 + globals.css `.nav-active-bar` |
| Topbar 60px sticky glass blur | Task 7 |
| App shell grid (sidebar + main) | Task 8 |
| Auth removal (local-only mode) | Task 9 |
| Service-role DB access, fixed profile | Task 10 |
| research_briefings cache table | Task 11 |
| getWeeklyBriefing / runWeeklyBriefing | Task 11 |
| 6-tile cockpit grid | Tasks 12–13 |
| Research tile action + status badge | Task 12 |
| PageShell on all app pages | Tasks 8, 15 |
| lucide-react strokeWidth 1.6 | Implemented in sidebar + tiles |

### Gaps / out-of-scope for this plan

- **Custom SVG charts** (Sparkline, AreaChart, Heatmap, Radial) — spec §3 "Flagged" list. Not in scope; /performance page will remain plain until a charts sprint.
- **Typewriter streaming draft** — compose page gets PageShell wrapper only; streaming animation is a compose-sprint item.
- **Tweaks panel** — prototype-only per spec; not needed.
- **Full briefing integration** — `runWeeklyBriefing()` stores a placeholder summary. Wiring into `generateWeeklyPosts` research phase is the next sprint.
- **Thread tile** — links to `/compose?mode=thread`; thread compose mode is a future feature.

### Placeholder scan

- Task 11 briefing.ts has a `// TODO` comment for full research integration. This is intentional and documented in Gaps above.

### Type consistency

- `Briefing` type defined in `src/server/briefing.ts` and imported in `research-tile.tsx` and `page.tsx`. Consistent.
- `supabaseService()` (sync, no await) vs `supabaseServer()` (async, needs await) — migration noted explicitly in Task 10 Step 4.
