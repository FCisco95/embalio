# Dispatch Design System — Full Visual Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the Dispatch design system at full visual parity to every page and component in the app — correct card padding, accent tab underlines, styled selects, brand avatars, score indicators, loading skeletons, and hand-rolled SVG charts.

**Architecture:** Outside-in — fix the three off-spec primitives first (Card, Tabs, Input/Textarea), then build four new shared components (StyledSelect, Skeleton, BrandAvatar, ScorePill/ScoreBar), then apply to all six pages, then add SVG charts last and wire them into Performance. Each task is independently committable.

**Tech Stack:** Next.js App Router, Tailwind CSS v4 with CSS custom properties, `@base-ui/react` primitives, lucide-react icons, TypeScript.

---

## File Map

### Modified
| File | What changes |
|---|---|
| `src/components/ui/card.tsx` | `py-4`→`py-5`, `px-4`→`px-5`, CardTitle font |
| `src/components/ui/tabs.tsx` | Line variant: `after:bg-foreground`→`after:bg-primary`, active text color |
| `src/components/ui/input.tsx` | `bg-transparent`→`bg-background`, accent focus ring |
| `src/components/ui/textarea.tsx` | Same as input |
| `src/components/cockpit/cockpit-tile.tsx` | Card component, emoji container |
| `src/components/cockpit/research-tile.tsx` | Card, BrandAvatar, Skeleton loading |
| `src/components/shell/sidebar.tsx` | BrandAvatar replaces hardcoded gradient |
| `src/app/(app)/engage/page.tsx` | Dispatch tab classes on `<a>` elements |
| `src/components/reply-queue.tsx` | Card, accent quote border, StyledSelect |
| `src/components/trend-radar.tsx` | Card, StyledSelect |
| `src/components/target-board.tsx` | Card, ScorePill/ScoreBar, StyledSelect |
| `src/components/weekly-composer.tsx` | Card, Skeleton loading, StyledSelect |
| `src/components/thread-composer.tsx` | Card, connector line, StyledSelect |
| `src/app/(app)/performance/page.tsx` | Stat chips, SegmentedNav, AreaChart, BarChart |
| `src/app/(app)/profiles/page.tsx` | Overline section titles |
| `src/components/profile-card.tsx` | CardHeader/CardContent, BrandAvatar, Input |

### Created
| File | What it exports |
|---|---|
| `src/components/ui/select-native.tsx` | `StyledSelect` |
| `src/components/ui/skeleton.tsx` | `Skeleton`, `SkeletonLine`, `SkeletonBlock` |
| `src/components/ui/brand-avatar.tsx` | `BrandAvatar` |
| `src/components/ui/score-bar.tsx` | `ScorePill`, `ScoreBar` |
| `src/components/charts/sparkline.tsx` | `Sparkline` |
| `src/components/charts/bar-chart.tsx` | `BarChart` |
| `src/components/charts/area-chart.tsx` | `AreaChart` |

---

## Task 1: Fix Card primitive

**Files:**
- Modify: `src/components/ui/card.tsx`

- [ ] **Step 1: Apply spec padding and CardTitle fix**

Replace the entire file:

```tsx
import * as React from "react"
import { cn } from "@/lib/utils"

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
        "group/card flex flex-col gap-4 overflow-hidden rounded-xl bg-card border border-border py-5 text-sm text-card-foreground has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:gap-3 data-[size=sm]:py-3",
        interactive && "card-interactive",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-5 group-data-[size=sm]/card:px-3 has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-5 group-data-[size=sm]/card:[.border-b]:pb-3",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "text-[13.5px] leading-snug font-semibold group-data-[size=sm]/card:text-sm",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-5 group-data-[size=sm]/card:px-3", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center rounded-b-xl border-t bg-muted/50 p-5 group-data-[size=sm]/card:p-3",
        className
      )}
      {...props}
    />
  )
}

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent }
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/card.tsx
git commit -m "fix(ui): Card padding 20px, CardTitle font-semibold per Dispatch spec"
```

---

## Task 2: Fix Tabs primitive

**Files:**
- Modify: `src/components/ui/tabs.tsx`

- [ ] **Step 1: Fix line variant active indicator to use accent color**

Two targeted changes in `TabsTrigger`:
1. `after:bg-foreground` → `after:bg-primary`
2. Add active brand-text color for line variant

Replace the `TabsTrigger` function:

```tsx
function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 aria-disabled:pointer-events-none aria-disabled:opacity-50 dark:text-muted-foreground dark:hover:text-foreground group-data-[variant=default]/tabs-list:data-active:shadow-sm group-data-[variant=line]/tabs-list:data-active:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        "data-active:bg-background data-active:text-foreground dark:data-active:border-input dark:data-active:bg-input/30 dark:data-active:text-foreground",
        "group-data-[variant=line]/tabs-list:data-active:text-brand-text group-data-[variant=line]/tabs-list:data-active:font-semibold",
        "after:absolute after:bg-primary after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className
      )}
      {...props}
    />
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/tabs.tsx
git commit -m "fix(ui): Tabs line variant uses accent underline + brand-text active label"
```

---

## Task 3: Fix Input and Textarea

**Files:**
- Modify: `src/components/ui/input.tsx`
- Modify: `src/components/ui/textarea.tsx`

- [ ] **Step 1: Fix Input — add bg-background and accent focus ring**

Replace `src/components/ui/input.tsx`:

```tsx
import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-background px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-primary/50 focus-visible:ring-3 focus-visible:ring-[color-mix(in_oklch,var(--primary)_50%,var(--border))] disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
```

- [ ] **Step 2: Fix Textarea — same background and focus ring**

Replace `src/components/ui/textarea.tsx`:

```tsx
import * as React from "react"
import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-background px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-primary/50 focus-visible:ring-3 focus-visible:ring-[color-mix(in_oklch,var(--primary)_50%,var(--border))] disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/input.tsx src/components/ui/textarea.tsx
git commit -m "fix(ui): Input/Textarea bg-background + accent focus ring per Dispatch spec"
```

---

## Task 4: Create StyledSelect

**Files:**
- Create: `src/components/ui/select-native.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface StyledSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  className?: string
}

export function StyledSelect({ className, children, ...props }: StyledSelectProps) {
  return (
    <div className="relative inline-flex items-center">
      <select
        className={cn(
          "appearance-none bg-background border border-border rounded-[10px] px-3 py-2 pr-8 text-[13.5px] text-foreground transition-colors outline-none cursor-pointer",
          "focus-visible:border-primary/50 focus-visible:ring-3 focus-visible:ring-[color-mix(in_oklch,var(--primary)_50%,var(--border))]",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 size-3.5 text-muted-foreground"
        strokeWidth={1.6}
      />
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/select-native.tsx
git commit -m "feat(ui): add StyledSelect — design-system-themed native select"
```

---

## Task 5: Create Skeleton

**Files:**
- Create: `src/components/ui/skeleton.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { cn } from "@/lib/utils"

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export function SkeletonLine({ className, ...props }: React.ComponentProps<"div">) {
  return <Skeleton className={cn("h-3 w-full", className)} {...props} />
}

export function SkeletonBlock({ className, ...props }: React.ComponentProps<"div">) {
  return <Skeleton className={cn("h-20 w-full", className)} {...props} />
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/skeleton.tsx
git commit -m "feat(ui): add Skeleton, SkeletonLine, SkeletonBlock shimmer placeholders"
```

---

## Task 6: Create BrandAvatar

**Files:**
- Create: `src/components/ui/brand-avatar.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { cn } from "@/lib/utils"

function getHue(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash + name.charCodeAt(i)) % 360
  }
  return hash
}

interface BrandAvatarProps {
  name: string
  size?: "sm" | "md"
  className?: string
}

export function BrandAvatar({ name, size = "sm", className }: BrandAvatarProps) {
  const hue = getHue(name)
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || name[0]?.toUpperCase() || "?"

  return (
    <div
      className={cn(
        "flex items-center justify-center shrink-0 font-bold text-white",
        size === "sm" ? "size-7 rounded-md text-[11px]" : "size-9 rounded-lg text-[13px]",
        className
      )}
      style={{
        background: `linear-gradient(135deg, hsl(${hue}deg 65% 50%), hsl(${(hue + 40) % 360}deg 70% 45%))`,
      }}
    >
      {initials}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/brand-avatar.tsx
git commit -m "feat(ui): add BrandAvatar — gradient initials avatar with name-derived hue"
```

---

## Task 7: Create ScorePill and ScoreBar

**Files:**
- Create: `src/components/ui/score-bar.tsx`

- [ ] **Step 1: Create the components**

```tsx
import { cn } from "@/lib/utils"

interface ScorePillProps {
  value: number
  className?: string
}

export function ScorePill({ value, className }: ScorePillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-[12px] font-semibold text-brand-text",
        className
      )}
      style={{
        background: `color-mix(in oklch, var(--primary) ${value * 0.22}%, transparent)`,
        borderColor: `color-mix(in oklch, var(--primary) 30%, transparent)`,
      }}
    >
      {value}
    </span>
  )
}

interface ScoreBarProps {
  value: number
  className?: string
}

export function ScoreBar({ value, className }: ScoreBarProps) {
  const clamped = Math.min(100, Math.max(0, value))
  return (
    <div className={cn("h-1.5 w-[100px] rounded-full bg-muted overflow-hidden", className)}>
      <div
        className="h-full rounded-full bg-primary/70 transition-all"
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/score-bar.tsx
git commit -m "feat(ui): add ScorePill and ScoreBar — accent-tinted score indicators"
```

---

## Task 8: Update Home / Cockpit

**Files:**
- Modify: `src/components/cockpit/cockpit-tile.tsx`
- Modify: `src/components/cockpit/research-tile.tsx`
- Modify: `src/components/shell/sidebar.tsx`

- [ ] **Step 1: Update CockpitTile**

Replace `src/components/cockpit/cockpit-tile.tsx`:

```tsx
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

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
    <Card interactive>
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="flex items-start justify-between gap-2">
          <div className="size-10 rounded-xl bg-surface-2 flex items-center justify-center text-2xl leading-none shrink-0">
            <span role="img" aria-label={title}>{emoji}</span>
          </div>
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
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Read the current ResearchTile**

Read `src/components/cockpit/research-tile.tsx` in full before editing. (Run: `cat src/components/cockpit/research-tile.tsx`)

- [ ] **Step 3: Update ResearchTile**

Replace `src/components/cockpit/research-tile.tsx` with the Card + BrandAvatar + Skeleton version:

```tsx
"use client"

import { useState } from "react"
import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { BrandAvatar } from "@/components/ui/brand-avatar"
import { SkeletonLine } from "@/components/ui/skeleton"
import type { Briefing } from "@/server/briefing"

interface ResearchTileProps {
  initialBriefing: Briefing | null
  onRun: () => Promise<{ ok: boolean; briefing?: Briefing; error?: string }>
}

export function ResearchTile({ initialBriefing, onRun }: ResearchTileProps) {
  const [briefing, setBriefing] = useState(initialBriefing)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setBusy(true)
    setError(null)
    const result = await onRun()
    if (result.ok && result.briefing) {
      setBriefing(result.briefing)
    } else {
      setError(result.error ?? "Something went wrong")
    }
    setBusy(false)
  }

  return (
    <Card interactive>
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="flex items-start justify-between gap-2">
          <BrandAvatar name="Research" size="sm" />
          <Sparkles className="size-4 text-muted-foreground" strokeWidth={1.6} />
        </div>

        <div className="flex flex-col gap-1.5 flex-1">
          <h3 className="text-[14px] font-semibold leading-snug">Weekly research</h3>

          {busy && (
            <div className="flex flex-col gap-2 mt-1">
              <SkeletonLine />
              <SkeletonLine className="w-4/5" />
              <SkeletonLine className="w-3/5" />
            </div>
          )}

          {!busy && briefing && (
            <p className="text-[13px] text-muted-foreground leading-relaxed line-clamp-3">
              {briefing.summary}
            </p>
          )}

          {!busy && !briefing && (
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              Run your weekly intelligence briefing to seed post generation.
            </p>
          )}

          {error && (
            <p className="text-[12px] text-destructive mt-1">{error}</p>
          )}
        </div>

        <Button
          variant="accentSoft"
          size="sm"
          className="w-full"
          onClick={run}
          disabled={busy}
        >
          {busy ? "Researching…" : briefing ? "Refresh briefing" : "Run briefing"}
        </Button>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: Update Sidebar — replace hardcoded gradient with BrandAvatar**

In `src/components/shell/sidebar.tsx`, replace the hardcoded gradient div in the brand chip footer:

Find:
```tsx
          <div
            className="size-7 rounded-md flex items-center justify-center shrink-0 text-[11px] font-bold text-primary-foreground"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
          >
            F
          </div>
```

Replace with:
```tsx
          <BrandAvatar name="fcisco95" size="sm" />
```

Add the import at the top of the file:
```tsx
import { BrandAvatar } from "@/components/ui/brand-avatar"
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/cockpit/cockpit-tile.tsx src/components/cockpit/research-tile.tsx src/components/shell/sidebar.tsx
git commit -m "feat(cockpit): Card layout, BrandAvatar, Skeleton loading on ResearchTile"
```

---

## Task 9: Update Compose page

**Files:**
- Modify: `src/components/weekly-composer.tsx`
- Modify: `src/components/thread-composer.tsx`

- [ ] **Step 1: Update WeeklyComposer — PostCard and loading state**

Replace `src/components/weekly-composer.tsx`:

```tsx
"use client";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { generateWeeklyPosts } from "@/server/original";
import type { WeeklyPost, WeeklyPostPlan } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StyledSelect } from "@/components/ui/select-native";
import { SkeletonLine } from "@/components/ui/skeleton";
import { toast } from "sonner";

const FORMAT_LABELS: Record<string, string> = {
  "quick-take": "quick take",
  "experiment": "experiment",
  "tool-find": "tool find",
  "observation": "observation",
  "reaction": "reaction",
};

const PROGRESS_MESSAGES = [
  "Researching the world...",
  "Checking GitHub...",
  "Reading the news...",
  "Finding your angles...",
  "Drafting...",
];

function PostCard({ post }: { post: WeeklyPost }) {
  const [body, setBody] = useState(post.posts.join("\n\n"));
  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="accent">{FORMAT_LABELS[post.format] ?? post.format}</Badge>
          {post.sourceDate && (
            <span className="text-[11px] text-muted-foreground">{post.sourceDate}</span>
          )}
        </div>
        {post.context && (
          <p className="text-[13px] italic text-muted-foreground mt-1">{post.context}</p>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-4">
        <Textarea
          rows={Math.min(10, body.split("\n").length + 2)}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="font-mono text-[14px]"
        />
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            onClick={() => { navigator.clipboard.writeText(body); toast.success("Copied"); }}
          >
            Copy
          </Button>
          {post.source && (
            <a
              href={post.source}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-brand-text underline underline-offset-2"
            >
              source
            </a>
          )}
          {post.suggestedVisual && (
            <span className="text-xs text-muted-foreground">Visual: {post.suggestedVisual}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function WeeklyComposer({ profiles }: { profiles: { id: string; handle: string }[] }) {
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? "");
  const [journal, setJournal] = useState("");
  const [plan, setPlan] = useState<WeeklyPostPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [progressIdx, setProgressIdx] = useState(0);

  async function generate() {
    setBusy(true);
    setProgressIdx(0);
    const ticker = setInterval(() => setProgressIdx((i) => Math.min(i + 1, PROGRESS_MESSAGES.length - 1)), 20_000);
    try {
      const result = await generateWeeklyPosts(profileId, journal || undefined);
      setPlan(result);
    } catch (e) {
      toast.error(String(e));
    } finally {
      clearInterval(ticker);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-3 flex-wrap">
        <StyledSelect
          aria-label="Profile"
          value={profileId}
          onChange={(e) => setProfileId(e.target.value)}
        >
          {profiles.map((p) => <option key={p.id} value={p.id}>{p.handle}</option>)}
        </StyledSelect>
        {profiles.length === 0 && (
          <p className="text-sm text-destructive">No profiles found. Create a profile first.</p>
        )}
      </div>

      <div className="space-y-1">
        <label className="text-sm text-muted-foreground">
          What are you working on this week? (optional)
        </label>
        <Textarea
          rows={3}
          placeholder="shipped X, broke Y, noticed Z while building..."
          value={journal}
          onChange={(e) => setJournal(e.target.value)}
          disabled={busy}
        />
      </div>

      <Button disabled={busy || !profileId} onClick={generate} className="w-full sm:w-auto">
        {busy ? PROGRESS_MESSAGES[progressIdx] : "Generate this week's posts"}
      </Button>

      {busy && (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-5">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary animate-spin" strokeWidth={1.6} />
              <span className="text-[13px] text-muted-foreground">{PROGRESS_MESSAGES[progressIdx]}</span>
            </div>
            <SkeletonLine />
            <SkeletonLine className="w-4/5" />
            <SkeletonLine className="w-3/5" />
          </CardContent>
        </Card>
      )}

      {plan && !busy && (
        <div className="space-y-4">
          <p className="text-[13px] text-muted-foreground">Week of {plan.weekOf} · {plan.posts.length} posts</p>
          {plan.posts.map((post, i) => (
            <PostCard key={i} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update ThreadComposer — TweetCard and connector lines**

Replace `src/components/thread-composer.tsx`:

```tsx
"use client";
import { useState } from "react";
import { generateThread, scoreDraftBreakout } from "@/server/original";
import type { ThreadDraft, BreakoutScore } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StyledSelect } from "@/components/ui/select-native";
import { toast } from "sonner";

const TYPE_LABELS: Record<string, string> = { hook: "hook", body: "body", cta: "cta" };
const TYPE_VARIANTS: Record<string, "accent" | "secondary" | "outline"> = {
  hook: "accent",
  body: "secondary",
  cta: "outline",
};

function ScoreBadge({ score }: { score: number }) {
  const variant = score >= 6 ? "good" : score >= 4 ? "warn" : "bad";
  return <Badge variant={variant}>{score}/7</Badge>;
}

function TweetCard({ tweet, type, idx }: { tweet: string; type: string; idx: number }) {
  const [body, setBody] = useState(tweet);
  const [score, setScore] = useState<BreakoutScore | null>(null);
  const [scoring, setScoring] = useState(false);

  async function checkBreakout() {
    setScoring(true);
    try {
      const result = await scoreDraftBreakout(body);
      setScore(result);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setScoring(false);
    }
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-muted-foreground font-mono">#{idx + 1}</span>
          <Badge variant={TYPE_VARIANTS[type] ?? "secondary"}>{TYPE_LABELS[type] ?? type}</Badge>
          <span className="text-[12px] text-muted-foreground ml-auto tabular-nums">{body.length}/280</span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-4">
        <Textarea
          rows={Math.max(2, Math.ceil(body.length / 60))}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="font-mono text-[14px]"
        />
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" onClick={() => { navigator.clipboard.writeText(body); toast.success("Copied"); }}>
            Copy
          </Button>
          <Button size="sm" variant="outline" disabled={scoring} onClick={checkBreakout}>
            {scoring ? "Scoring…" : "Breakout check"}
          </Button>
          {score && (
            <div className="flex items-center gap-2">
              <ScoreBadge score={score.score} />
              <span className="text-[12px] text-muted-foreground">{score.verdict}</span>
            </div>
          )}
        </div>
        {score && score.fixes.length > 0 && (
          <ul className="text-[12px] text-muted-foreground list-disc list-inside space-y-0.5">
            {score.fixes.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function ThreadComposer({ profiles }: { profiles: { id: string; handle: string }[] }) {
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? "");
  const [topic, setTopic] = useState("");
  const [draft, setDraft] = useState<ThreadDraft | null>(null);
  const [busy, setBusy] = useState(false);

  async function generate() {
    if (!topic.trim()) { toast.error("Enter a topic first"); return; }
    setBusy(true);
    try {
      const result = await generateThread(profileId, topic);
      setDraft(result);
      if (result.thin) toast.info("Content may be thin for a thread — consider a single post instead.");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-3 flex-wrap">
        <StyledSelect
          aria-label="Profile"
          value={profileId}
          onChange={(e) => setProfileId(e.target.value)}
        >
          {profiles.map((p) => <option key={p.id} value={p.id}>{p.handle}</option>)}
        </StyledSelect>
        {profiles.length === 0 && (
          <p className="text-sm text-destructive">No profiles found. Create a profile first.</p>
        )}
      </div>

      <div className="space-y-1">
        <label className="text-sm text-muted-foreground">Thread topic or idea</label>
        <Textarea
          rows={2}
          placeholder="What you want to thread about — a finding, experiment, workflow, contrarian take…"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          disabled={busy}
        />
      </div>

      <Button disabled={busy || !profileId || !topic.trim()} onClick={generate} className="w-full sm:w-auto">
        {busy ? "Drafting thread…" : "Draft thread"}
      </Button>

      {draft?.thin && draft.thin_suggestion && (
        <div className="border border-warning/30 bg-warning/10 rounded-lg p-3 text-sm">
          <span className="font-medium">Content looks thin for a thread.</span>{" "}
          Single-post suggestion: <span className="italic">{draft.thin_suggestion}</span>
        </div>
      )}

      {draft && (
        <div className="space-y-0">
          <p className="text-[13px] text-muted-foreground mb-3">{draft.tweets.length} tweets</p>
          {draft.tweets.map((t, i) => (
            <div key={i} className="relative">
              {i < draft.tweets.length - 1 && (
                <div className="absolute left-[22px] top-full h-3 w-0.5 bg-primary/20 z-10" />
              )}
              <TweetCard idx={i} tweet={t.tweet} type={t.type} />
              {i < draft.tweets.length - 1 && <div className="h-3" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/weekly-composer.tsx src/components/thread-composer.tsx
git commit -m "feat(compose): Card layout, Skeleton loading, StyledSelect, thread connectors"
```

---

## Task 10: Update Engage page

**Files:**
- Modify: `src/app/(app)/engage/page.tsx`
- Modify: `src/components/reply-queue.tsx`
- Modify: `src/components/trend-radar.tsx`

- [ ] **Step 1: Update Engage page tabs**

Replace `src/app/(app)/engage/page.tsx`:

```tsx
import { listProfiles } from "@/server/profiles";
import { ReplyQueuePanel } from "@/components/reply-queue";
import { TrendRadarPanel } from "@/components/trend-radar";
import { PageShell } from "@/components/shell/page-shell";

export default async function EngagePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const profiles = (await listProfiles()) ?? [];
  const { tab } = await searchParams;
  const activeTab = tab === "trends" ? "trends" : "replies";

  return (
    <PageShell title="Engage">
      <div className="flex gap-1 border-b border-border mb-6">
        <a
          href="/engage"
          className={[
            "relative px-4 py-2 text-[13.5px] font-medium transition-colors",
            activeTab === "replies"
              ? "text-brand-text font-semibold after:absolute after:bottom-0 after:inset-x-0 after:h-0.5 after:bg-primary after:rounded-t"
              : "text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          Reply queue
        </a>
        <a
          href="/engage?tab=trends"
          className={[
            "relative px-4 py-2 text-[13.5px] font-medium transition-colors",
            activeTab === "trends"
              ? "text-brand-text font-semibold after:absolute after:bottom-0 after:inset-x-0 after:h-0.5 after:bg-primary after:rounded-t"
              : "text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          Trend radar
        </a>
      </div>

      {activeTab === "replies" && (
        <>
          <p className="text-[13px] text-muted-foreground mb-4">
            Reply opportunities from your seed accounts in the last 24h.
          </p>
          <ReplyQueuePanel profiles={profiles} />
        </>
      )}

      {activeTab === "trends" && (
        <>
          <p className="text-[13px] text-muted-foreground mb-4">
            2–3 niche trends right now with concrete post angles.
          </p>
          <TrendRadarPanel profiles={profiles} />
        </>
      )}
    </PageShell>
  );
}
```

- [ ] **Step 2: Update ReplyQueuePanel**

Replace `src/components/reply-queue.tsx`:

```tsx
"use client";
import { useState } from "react";
import { generateReplyQueue } from "@/server/engage";
import type { ReplyOpportunity, ReplyQueue } from "@/lib/schemas";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { StyledSelect } from "@/components/ui/select-native";
import { toast } from "sonner";

function ReplyCard({ opp }: { opp: ReplyOpportunity }) {
  const [reply, setReply] = useState(opp.reply);
  const [skipped, setSkipped] = useState(false);

  if (skipped) return null;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-[13.5px]">
            <span className="font-semibold">{opp.targetHandle}</span>
            {opp.targetLikes > 0 && (
              <span className="text-[12px] text-muted-foreground tabular-nums">{opp.targetLikes} likes</span>
            )}
            {opp.postedAt && (
              <span className="text-[12px] text-muted-foreground">{opp.postedAt}</span>
            )}
          </div>
          <p className="text-[13.5px] text-muted-foreground border-l-[3px] border-primary/40 pl-3">
            {opp.targetPost}
          </p>
          <p className="text-[12px] text-muted-foreground italic">{opp.reason}</p>
        </div>
        <Textarea
          rows={3}
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          className="font-mono text-[14px]"
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => { navigator.clipboard.writeText(reply); toast.success("Copied"); }}
          >
            Copy reply
          </Button>
          {opp.targetUrl && (
            <a
              href={opp.targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ size: "sm", variant: "outline" })}
            >
              View post
            </a>
          )}
          <Button size="sm" variant="ghost" onClick={() => setSkipped(true)}>
            Skip
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ReplyQueuePanel({ profiles }: { profiles: { id: string; handle: string }[] }) {
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? "");
  const [queue, setQueue] = useState<ReplyQueue | null>(null);
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    try {
      const result = await generateReplyQueue(profileId);
      setQueue(result);
      if (result.opportunities.length === 0) {
        toast.info("No reply opportunities found in the last 24h — try again later");
      }
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-3 flex-wrap">
        <StyledSelect
          aria-label="Profile"
          value={profileId}
          onChange={(e) => setProfileId(e.target.value)}
        >
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>{p.handle}</option>
          ))}
        </StyledSelect>
        <Button disabled={busy || !profileId} onClick={generate}>
          {busy ? "Scanning seed accounts..." : "Generate reply queue"}
        </Button>
        {profiles.length === 0 && (
          <p className="text-sm text-destructive">No profiles found. Create a profile first.</p>
        )}
      </div>

      {queue && (
        <div className="space-y-4">
          <p className="text-[13px] text-muted-foreground">
            {queue.generatedAt} · {queue.opportunities.length} opportunities
          </p>
          {queue.opportunities.length === 0 && (
            <p className="text-muted-foreground text-[13px]">Nothing worth replying to right now.</p>
          )}
          {queue.opportunities.map((opp) => (
            <ReplyCard
              key={opp.targetUrl || `${opp.targetHandle}-${opp.targetPost.slice(0, 40)}`}
              opp={opp}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Update TrendRadarPanel**

Replace `src/components/trend-radar.tsx`:

```tsx
"use client";
import { useState } from "react";
import { generateTrendRadar } from "@/server/trends";
import type { TrendReport } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { StyledSelect } from "@/components/ui/select-native";
import { toast } from "sonner";

function TrendCard({ topic, why_now, angle, source }: {
  topic: string; why_now: string; angle: string; source?: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 pt-5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-[14px]">{topic}</span>
          <Badge variant="accent">trending</Badge>
        </div>
        <p className="text-[13px]">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Why now: </span>
          {why_now}
        </p>
        <p className="text-[13.5px]">
          <span className="text-muted-foreground font-medium">Angle: </span>
          {angle}
        </p>
        {source && (
          <a href={source} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-text underline underline-offset-2">
            source →
          </a>
        )}
      </CardContent>
    </Card>
  );
}

export function TrendRadarPanel({ profiles }: { profiles: { id: string; handle: string }[] }) {
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? "");
  const [report, setReport] = useState<TrendReport | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const result = await generateTrendRadar(profileId);
      setReport(result);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-3 flex-wrap">
        <StyledSelect
          aria-label="Profile"
          value={profileId}
          onChange={(e) => setProfileId(e.target.value)}
        >
          {profiles.map((p) => <option key={p.id} value={p.id}>{p.handle}</option>)}
        </StyledSelect>
        <Button disabled={busy || !profileId} onClick={run}>
          {busy ? "Scanning trends…" : "Scan niche trends"}
        </Button>
        {profiles.length === 0 && (
          <p className="text-sm text-destructive">No profiles found. Create a profile first.</p>
        )}
      </div>

      {report && (
        <div className="space-y-3">
          <p className="text-[13px] text-muted-foreground">{report.generatedAt} · {report.trends.length} trends</p>
          {report.trends.map((t, i) => (
            <TrendCard key={i} {...t} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/(app)/engage/page.tsx src/components/reply-queue.tsx src/components/trend-radar.tsx
git commit -m "feat(engage): Dispatch tab underline, Card layout on reply/trend cards, StyledSelect"
```

---

## Task 11: Update Board page

**Files:**
- Modify: `src/components/target-board.tsx`

- [ ] **Step 1: Update TargetBoardPanel and TargetCard**

Replace `src/components/target-board.tsx`:

```tsx
"use client";
import { useState } from "react";
import { generateTargetQueue } from "@/server/target-queue";
import type { TargetQueue } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { StyledSelect } from "@/components/ui/select-native";
import { ScorePill, ScoreBar } from "@/components/ui/score-bar";
import { toast } from "sonner";

const PRIORITY_VARIANTS: Record<string, "good" | "warn" | "bad"> = {
  high: "good",
  medium: "warn",
  low: "bad",
};

const PRIORITY_SCORES: Record<string, number> = {
  high: 80,
  medium: 50,
  low: 25,
};

function TargetCard({ handle, reason, priority, suggested_approach }: {
  handle: string; reason: string; priority: string; suggested_approach: string;
}) {
  const score = PRIORITY_SCORES[priority] ?? 50;
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-[14px]">
            {handle.startsWith("@") ? handle : `@${handle}`}
          </span>
          <Badge variant={PRIORITY_VARIANTS[priority] ?? "secondary"}>{priority}</Badge>
          <div className="flex items-center gap-2 ml-auto">
            <ScorePill value={score} />
            <ScoreBar value={score} />
          </div>
        </div>
        <p className="text-[13px] text-muted-foreground">{reason}</p>
        <div className="bg-surface-2 rounded-[10px] p-3">
          <p className="text-[13px]">
            <span className="font-medium text-muted-foreground">Approach: </span>
            {suggested_approach}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function TargetBoardPanel({ profiles }: { profiles: { id: string; handle: string }[] }) {
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? "");
  const [queue, setQueue] = useState<TargetQueue | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const result = await generateTargetQueue(profileId);
      setQueue(result);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-3 flex-wrap">
        <StyledSelect
          aria-label="Profile"
          value={profileId}
          onChange={(e) => setProfileId(e.target.value)}
        >
          {profiles.map((p) => <option key={p.id} value={p.id}>{p.handle}</option>)}
        </StyledSelect>
        <Button disabled={busy || !profileId} onClick={run}>
          {busy ? "Finding targets…" : "Find who to engage"}
        </Button>
        {profiles.length === 0 && (
          <p className="text-sm text-destructive">No profiles found. Create a profile first.</p>
        )}
      </div>

      {queue && (
        <div className="space-y-3">
          <p className="text-[13px] text-muted-foreground">
            {queue.generatedAt} · {queue.targets.length} targets
          </p>
          {queue.targets.length === 0 && (
            <p className="text-[13px] text-muted-foreground">No targets found — try updating your content pillars.</p>
          )}
          {queue.targets.map((t, i) => (
            <TargetCard key={i} {...t} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/target-board.tsx
git commit -m "feat(board): Card layout, ScorePill/ScoreBar priority display, StyledSelect"
```

---

## Task 12: Update Profiles / Voice page

**Files:**
- Modify: `src/app/(app)/profiles/page.tsx`
- Modify: `src/components/profile-card.tsx`

- [ ] **Step 1: Update Profiles page — overline section titles**

Replace `src/app/(app)/profiles/page.tsx`:

```tsx
import { listProfiles } from "@/server/profiles";
import { ProfileForm } from "@/components/profile-form";
import { ProfileCard } from "@/components/profile-card";
import { PageShell } from "@/components/shell/page-shell";

export default async function ProfilesPage() {
  const profiles = await listProfiles();
  return (
    <PageShell title="Voice">
      <div className="space-y-10 max-w-2xl">
        <section>
          <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground mb-3">
            New profile
          </p>
          <ProfileForm />
        </section>
        <section className="space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground mb-3">
            Your profiles
          </p>
          {(profiles ?? []).map((p) => <ProfileCard key={p.id} profile={p} />)}
          {(profiles ?? []).length === 0 && (
            <p className="text-[13px] text-muted-foreground">No profiles yet — create one above.</p>
          )}
        </section>
      </div>
    </PageShell>
  );
}
```

- [ ] **Step 2: Update ProfileCard**

Replace `src/components/profile-card.tsx`:

```tsx
import { listSeedTargets, addSeedTarget } from "@/server/profiles";
import { getPostingAccount } from "@/server/posting";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BrandAvatar } from "@/components/ui/brand-avatar";
import { PostingConfig } from "@/components/posting-config";
import { OnboardingWizard } from "@/components/onboarding-wizard";

export async function ProfileCard({ profile }: { profile: { id: string; handle: string; niche_description: string | null } }) {
  const targets = await listSeedTargets(profile.id);
  const postingEnabled = process.env.NEXT_PUBLIC_POSTING_ENABLED === "true";
  const account = postingEnabled ? await getPostingAccount(profile.id) : null;

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-center gap-3">
          <BrandAvatar name={profile.handle} size="md" />
          <div className="min-w-0">
            <CardTitle>{profile.handle}</CardTitle>
            {profile.niche_description && (
              <CardDescription className="truncate">{profile.niche_description}</CardDescription>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-4">
        <form
          action={async (fd: FormData) => {
            "use server";
            await addSeedTarget({ profile_id: profile.id, handle: String(fd.get("handle")) });
          }}
          className="flex gap-2 items-center"
        >
          <Input name="handle" placeholder="@seed_account" className="flex-1" />
          <Button type="submit" variant="accentSoft" size="sm">Add seed</Button>
        </form>
        <div className="flex items-center gap-2">
          <p className="text-[12px] text-muted-foreground">Seed targets</p>
          <Badge variant="secondary">{targets?.length ?? 0}</Badge>
        </div>
        {postingEnabled && <PostingConfig profileId={profile.id} current={account?.adspower_user_id} />}
        <OnboardingWizard profileId={profile.id} />
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/(app)/profiles/page.tsx src/components/profile-card.tsx
git commit -m "feat(profiles): overline section titles, Card layout, BrandAvatar, Input seed form"
```

---

## Task 13: Build Sparkline chart

**Files:**
- Create: `src/components/charts/sparkline.tsx`

- [ ] **Step 1: Create directory and component**

```bash
mkdir -p src/components/charts
```

Create `src/components/charts/sparkline.tsx`:

```tsx
interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  className?: string
}

export function Sparkline({ data, width = 60, height = 20, className }: SparklineProps) {
  if (data.length < 2) return null

  const pad = 2
  const innerW = width - pad * 2
  const innerH = height - pad * 2

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const xs = data.map((_, i) => pad + (i / (data.length - 1)) * innerW)
  const ys = data.map((v) => pad + innerH - ((v - min) / range) * innerH)

  const linePath = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x},${ys[i]}`).join(" ")
  const areaPath = `${linePath} L${xs[xs.length - 1]},${height - pad} L${xs[0]},${height - pad} Z`

  const lastX = xs[xs.length - 1]
  const lastY = ys[ys.length - 1]

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#spark-fill)" />
      <path d={linePath} fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="2" fill="var(--primary)" />
    </svg>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/charts/sparkline.tsx
git commit -m "feat(charts): hand-rolled Sparkline SVG with gradient area fill"
```

---

## Task 14: Build BarChart

**Files:**
- Create: `src/components/charts/bar-chart.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client"

import { useState } from "react"

interface BarChartProps {
  data: { label: string; value: number }[]
  height?: number
  className?: string
}

export function BarChart({ data, height = 120, className }: BarChartProps) {
  const [hovered, setHovered] = useState<number | null>(null)

  if (data.length === 0) return null

  const labelH = 20
  const chartH = height - labelH
  const gap = 4
  const totalGap = gap * (data.length - 1)
  const barW = (100 - totalGap) / data.length  // percentage width per bar

  const max = Math.max(...data.map((d) => d.value), 1)

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      className={className}
      aria-label="Bar chart"
    >
      {data.map((d, i) => {
        const x = i * (barW + gap)
        const barH = (d.value / max) * chartH
        const y = chartH - barH
        const isHovered = hovered === i
        const labelX = x + barW / 2

        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={barH}
              rx="2"
              fill={isHovered ? "var(--primary)" : "color-mix(in oklch, var(--primary) 30%, transparent)"}
              style={{ transition: "fill 0.12s" }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            />
            <text
              x={labelX}
              y={height - 4}
              textAnchor="middle"
              fontSize="8"
              fill="var(--muted-foreground)"
            >
              {d.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/charts/bar-chart.tsx
git commit -m "feat(charts): hand-rolled BarChart SVG with hover highlight"
```

---

## Task 15: Build AreaChart

**Files:**
- Create: `src/components/charts/area-chart.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client"

import { useRef, useState, useEffect } from "react"

interface AreaChartProps {
  data: { x: string; y: number }[]
  height?: number
  className?: string
}

export function AreaChart({ data, height = 180, className }: AreaChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(600)
  const [crosshairX, setCrosshairX] = useState<number | null>(null)
  const [tooltipIdx, setTooltipIdx] = useState<number | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w) setWidth(w)
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  if (data.length < 2) return null

  const padT = 8
  const padB = 24
  const padX = 4
  const innerW = width - padX * 2
  const innerH = height - padT - padB

  const min = Math.min(...data.map((d) => d.y))
  const max = Math.max(...data.map((d) => d.y), 1)
  const range = max - min || 1

  const xs = data.map((_, i) => padX + (i / (data.length - 1)) * innerW)
  const ys = data.map((d) => padT + innerH - ((d.y - min) / range) * innerH)

  const linePath = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x},${ys[i]}`).join(" ")
  const areaPath = `${linePath} L${xs[xs.length - 1]},${height - padB} L${xs[0]},${height - padB} Z`

  const gridLines = [0.25, 0.5, 0.75].map((t) => padT + innerH * (1 - t))

  const xLabels = [0, Math.floor(data.length / 2), data.length - 1]

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const mouseX = ((e.clientX - rect.left) / rect.width) * width
    const closest = xs.reduce((bestIdx, x, i) =>
      Math.abs(x - mouseX) < Math.abs(xs[bestIdx] - mouseX) ? i : bestIdx, 0)
    setCrosshairX(xs[closest])
    setTooltipIdx(closest)
  }

  function handleMouseLeave() {
    setCrosshairX(null)
    setTooltipIdx(null)
  }

  const tooltipItem = tooltipIdx !== null ? data[tooltipIdx] : null
  const tooltipXPos = tooltipIdx !== null ? xs[tooltipIdx] : 0
  const tooltipYPos = tooltipIdx !== null ? ys[tooltipIdx] : 0

  return (
    <div ref={containerRef} className={className} style={{ position: "relative" }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ display: "block" }}
      >
        <defs>
          <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {gridLines.map((y, i) => (
          <line
            key={i}
            x1={padX}
            y1={y}
            x2={width - padX}
            y2={y}
            stroke="var(--border)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
        ))}

        <path d={areaPath} fill="url(#area-fill)" />
        <path d={linePath} fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

        {crosshairX !== null && (
          <line
            x1={crosshairX}
            y1={padT}
            x2={crosshairX}
            y2={height - padB}
            stroke="var(--primary)"
            strokeWidth="1"
            strokeOpacity="0.4"
            strokeDasharray="3 3"
          />
        )}

        {tooltipIdx !== null && (
          <circle cx={xs[tooltipIdx]} cy={ys[tooltipIdx]} r="3" fill="var(--primary)" />
        )}

        {xLabels.map((idx) => (
          <text
            key={idx}
            x={xs[idx]}
            y={height - 6}
            textAnchor={idx === 0 ? "start" : idx === data.length - 1 ? "end" : "middle"}
            fontSize="10"
            fill="var(--muted-foreground)"
          >
            {data[idx].x}
          </text>
        ))}
      </svg>

      {tooltipItem && (
        <div
          style={{
            position: "absolute",
            left: Math.min(tooltipXPos + 8, width - 100),
            top: Math.max(tooltipYPos - 36, 0),
            pointerEvents: "none",
          }}
          className="bg-card border border-border rounded-[8px] px-2.5 py-1.5 text-[12px] shadow-elev whitespace-nowrap"
        >
          <span className="text-muted-foreground">{tooltipItem.x}: </span>
          <span className="font-semibold tabular-nums">{tooltipItem.y}</span>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/charts/area-chart.tsx
git commit -m "feat(charts): hand-rolled AreaChart SVG with crosshair, tooltip, ResizeObserver"
```

---

## Task 16: Wire charts into Performance page

**Files:**
- Modify: `src/app/(app)/performance/page.tsx`

- [ ] **Step 1: Replace the Performance page with stat chips, AreaChart, BarChart, and improved table**

Replace `src/app/(app)/performance/page.tsx`:

```tsx
import { listProfiles } from "@/server/profiles";
import { listPerformance } from "@/server/posts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageShell } from "@/components/shell/page-shell";
import { AreaChart } from "@/components/charts/area-chart";
import { BarChart } from "@/components/charts/bar-chart";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ profile?: string }>;
}) {
  const { profile } = await searchParams;
  const profiles = (await listProfiles()) ?? [];
  const active = profile ?? profiles[0]?.id;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const posts: Array<Record<string, any>> = active
    ? ((await listPerformance(active)) ?? [])
    : [];

  // Stat calculations
  const totalLikes = posts.reduce((s, p) => s + (p.metrics?.likes ?? 0), 0);
  const totalViews = posts.reduce((s, p) => s + (p.metrics?.views ?? 0), 0);
  const avgLikes = posts.length ? Math.round(totalLikes / posts.length) : 0;

  // AreaChart: likes over time (sorted by posted_at)
  const timelineData = [...posts]
    .sort((a, b) => new Date(a.posted_at).getTime() - new Date(b.posted_at).getTime())
    .map((p) => ({
      x: new Date(p.posted_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      y: p.metrics?.likes ?? 0,
    }));

  // BarChart: posts per day of week
  const dayCounts = Array(7).fill(0) as number[];
  posts.forEach((p) => {
    const d = new Date(p.posted_at).getDay();
    dayCounts[d]++;
  });
  const weeklyData = DAY_LABELS.map((label, i) => ({ label, value: dayCounts[i] }));

  return (
    <PageShell title="Performance">
      <div className="space-y-6">
        {/* Profile filter */}
        <div className="flex gap-1 p-1 bg-surface-2 rounded-full w-fit">
          {profiles.map((p) => (
            <a
              key={p.id}
              href={`/performance?profile=${p.id}`}
              className={[
                "px-3 py-1 rounded-full text-[13px] font-medium transition-colors",
                p.id === active
                  ? "bg-card border border-border text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {p.handle}
            </a>
          ))}
        </div>

        {/* Stat chips */}
        <div className="grid grid-cols-2 gap-[18px] sm:grid-cols-4">
          {[
            { label: "Posts", value: posts.length },
            { label: "Total likes", value: totalLikes },
            { label: "Total views", value: totalViews },
            { label: "Avg likes", value: avgLikes },
          ].map(({ label, value }) => (
            <Card key={label}>
              <CardContent className="pt-5">
                <div className="text-[26px] font-bold tabular-nums tracking-[-0.02em]">
                  {value.toLocaleString()}
                </div>
                <div className="text-[12px] text-muted-foreground mt-0.5">{label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts row */}
        {posts.length > 1 && (
          <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[2fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Likes over time</CardTitle>
              </CardHeader>
              <CardContent>
                <AreaChart data={timelineData} height={180} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Posts by day</CardTitle>
              </CardHeader>
              <CardContent>
                <BarChart data={weeklyData} height={120} />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Posts table */}
        <Card>
          <CardHeader>
            <CardTitle>All posts</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Post</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead className="tabular-nums">Likes</TableHead>
                  <TableHead className="tabular-nums">Views</TableHead>
                  <TableHead>Posted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map((p) => (
                  <TableRow key={p.id} className="hover:bg-surface-2">
                    <TableCell className="max-w-md">
                      <a
                        href={p.tweet_url}
                        target="_blank"
                        className="underline underline-offset-2 text-brand-text truncate block"
                      >
                        {p.drafts?.body ?? p.tweet_url}
                      </a>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.drafts?.kind}</TableCell>
                    <TableCell className="tabular-nums">{p.metrics?.likes ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{p.metrics?.views ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(p.posted_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
                {posts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No posts tracked yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Build check**

```bash
npm run build
```

Expected: builds successfully with no TypeScript or Next.js errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/(app)/performance/page.tsx
git commit -m "feat(performance): stat chips, AreaChart + BarChart, styled table, segmented profile filter"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Phase 1 — Card (Task 1), Tabs (Task 2), Input/Textarea (Task 3)
- ✅ Phase 2 — StyledSelect (Task 4), Skeleton (Task 5), BrandAvatar (Task 6), ScorePill/ScoreBar (Task 7)
- ✅ Phase 3 — Home/Cockpit (Task 8)
- ✅ Phase 4 — Compose (Task 9)
- ✅ Phase 5 — Engage (Task 10)
- ✅ Phase 6 — Board (Task 11)
- ✅ Phase 7 — Performance (Task 16, after charts in Tasks 13–15)
- ✅ Phase 8 — Profiles/Voice (Task 12)
- ✅ Phase 9 — Charts (Tasks 13–15)

**Type consistency:**
- `StyledSelect` props extend `React.SelectHTMLAttributes<HTMLSelectElement>` — compatible with all 5 call sites using `value`/`onChange`/`aria-label`/`children`
- `BrandAvatar` prop `name: string` used consistently in Sidebar (Task 8), ResearchTile (Task 8), ProfileCard (Task 12)
- `ScorePill` and `ScoreBar` both take `value: number` — used in Task 11 with derived `PRIORITY_SCORES` map
- `Sparkline` is imported in Performance page but NOT used (table Sparkline column was simplified to remove it since per-post time-series data doesn't exist in the schema). No dangling import.
- `AreaChart` and `BarChart` are client components wired into the server `PerformancePage` via serializable props — valid in Next.js App Router.
