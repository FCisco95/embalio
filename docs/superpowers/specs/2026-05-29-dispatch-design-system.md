# Dispatch Design System — Full Visual Parity

**Date:** 2026-05-29
**Approach:** Outside-in (A) — primitives → shell → pages → charts
**Chart strategy:** All hand-rolled inline SVG, no charting library

---

## 1. What's Already Done

The following are fully spec-compliant and require **no changes**:

- `globals.css` — all Dispatch tokens (colors, shadows, glow, font stack, `card-interactive`, `nav-active-bar`)
- `Sidebar` — 236px width, active nav with `color-mix(oklch)` bg + 3px accent left-bar, brand chip footer
- `Topbar` — 60px, backdrop blur, translucent surface bg
- `Button` — `default` (primary + glow), `ghost`, `secondary`, `outline`, `accentSoft`, `destructive`, `link`; all sizes
- `Badge` — `good`, `warn`, `bad`, `accent` tone variants using `color-mix` exactly as spec

---

## 2. Phase 1 — Primitive Fixes

### 2.1 `Card` (`src/components/ui/card.tsx`)
- Change `py-4 px-4` → `py-5 px-5` (spec: 20px default card padding)
- `CardTitle`: replace `font-heading` (non-existent) with `font-semibold text-[13.5px]` (spec: card title 13–13.5px, 600 weight)
- `CardFooter`: no change

### 2.2 `Tabs` (`src/components/ui/tabs.tsx`)
- Line variant active indicator: `after:bg-foreground` → `after:bg-primary`
- Add `group-data-[variant=line]/tabs-list:data-active:text-brand-text` to `TabsTrigger` so active tab label uses accent-text color

### 2.3 `Input` (`src/components/ui/input.tsx`)
- Add `bg-background` (spec: input bg is `--bg`, darker than card)
- Focus ring: replace `focus-visible:ring-ring/50` with `focus-visible:ring-[color-mix(in_oklch,var(--primary)_50%,var(--border))]`
- Add `focus-visible:border-primary/50`

### 2.4 `Textarea` (`src/components/ui/textarea.tsx`)
- Same focus ring changes as Input
- Add `bg-background`

---

## 3. Phase 2 — New Shared Components

### 3.1 `StyledSelect` (`src/components/ui/select-native.tsx`)
- Styled wrapper around native `<select>` — same props as `<select>`
- Styles: `bg-background border border-border text-[13.5px] rounded-[10px] px-3 py-2`
- Focus ring: same as Input
- `appearance-none` + CSS chevron via `background-image` (SVG data URI of ChevronDown)
- Replaces all 5 raw `<select>` elements: `WeeklyComposer`, `ThreadComposer`, `ReplyQueuePanel`, `TrendRadarPanel`, `TargetBoardPanel`

### 3.2 `Skeleton` (`src/components/ui/skeleton.tsx`)
- Base: `animate-pulse rounded-md bg-muted`
- `SkeletonLine`: full-width, `h-3` — used for text placeholders
- `SkeletonBlock`: arbitrary size via `className` — used for card/image placeholders
- Used in: `ResearchTile` (briefing loading), `WeeklyComposer` + `ThreadComposer` (generation loading)

### 3.3 `BrandAvatar` (`src/components/ui/brand-avatar.tsx`)
- Props: `name: string`, `size?: "sm" | "md"` (default `"sm"`)
- `sm`: `size-7 rounded-md` (28px) — sidebar footer, ProfileCard
- `md`: `size-9 rounded-lg` (36px) — profile headers
- Gradient: hue derived from `charCodeAt` sum of name mod 360 → `linear-gradient(135deg, hsl(hue, 65%, 50%), hsl(hue+40deg, 70%, 45%))`
- Displays first 1–2 initials, `text-white font-bold`
- Replaces hardcoded gradient in Sidebar footer brand chip

### 3.4 `ScorePill` + `ScoreBar` (`src/components/ui/score-bar.tsx`)
- `ScorePill`: props `value: number` (0–100). Fill: `color-mix(in oklch, var(--primary) calc(value * 0.22%), transparent)`. Border: `color-mix(... 30%, transparent)`. Text: `text-brand-text font-semibold text-[12px]`. Pill radius.
- `ScoreBar`: props `value: number` (0–100). 100px track, `h-1.5 rounded-full bg-muted`. Fill: `bg-primary/70`, width `${value}%`.
- Used in: `TargetBoardPanel` (`TargetCard` priority display)

---

## 4. Phase 3 — Home / Cockpit

**Files:** `src/app/page.tsx`, `src/components/cockpit/cockpit-tile.tsx`, `src/components/cockpit/research-tile.tsx`

### CockpitTile
- Replace raw `div.card-interactive` with `<Card interactive>` + `CardContent`
- Emoji: wrap in `size-10 rounded-xl bg-surface-2 flex items-center justify-center text-2xl` container
- Title: `text-[14px] font-semibold leading-snug`
- Description: `text-[13px] text-muted-foreground leading-relaxed`
- CTA: stays `<Button variant="accentSoft" size="sm" className="w-full">`

### ResearchTile
- Same Card treatment as CockpitTile
- Header icon: `BrandAvatar` with name `"Research"` (gives consistent gradient)
- Loading state: replace blank/spinner with 3 `SkeletonLine` blocks (widths 100%, 80%, 60%), inside Card body
- Briefing content: title `font-semibold text-[14px]`, body `text-[13.5px] leading-relaxed`

### Page layout
- No changes — grid `grid-cols-2 gap-[18px] lg:grid-cols-3` and heading `text-2xl font-bold` already correct

---

## 5. Phase 4 — Compose

**Files:** `src/app/(app)/compose/page.tsx`, `src/components/weekly-composer.tsx`, `src/components/thread-composer.tsx`

### WeeklyComposer — PostCard
- Replace raw `div.border.rounded-lg` with `<Card>` + `<CardHeader>` + `<CardContent>`
- CardHeader: format `<Badge variant="accent">` (not `secondary`) + source date `text-[11px] text-muted-foreground`
- Context line: `text-[13px] italic text-muted-foreground`
- Textarea: `bg-background font-mono text-[14px]`
- Source link: `text-brand-text text-xs underline underline-offset-2`
- Profile selector → `StyledSelect`

### WeeklyComposer — Loading state
- During generation: show 3 `SkeletonLine` blocks inside a `Card` shell instead of the progress text message
- Spinning `<Sparkles>` icon (16px, `animate-spin`) alongside first skeleton line

### ThreadComposer
- Each thread node → `<Card>` with `CardContent`
- Connector between nodes: `border-l-2 border-primary/30 ml-4 pl-4 my-1`
- Profile selector → `StyledSelect`

---

## 6. Phase 5 — Engage

**Files:** `src/app/(app)/engage/page.tsx`, `src/components/reply-queue.tsx`, `src/components/trend-radar.tsx`

### Engage page tabs
- Page is a Server Component and tab switching is `href`-based, so avoid adding a `"use client"` boundary just for tab visuals
- Instead, apply Dispatch tab styling directly to the existing `<a>` elements:
  - Container: `flex gap-1 border-b border-border mb-6`
  - Each `<a>`: `relative px-4 py-2 text-[13.5px] font-medium transition-colors`
  - Active: `text-brand-text after:absolute after:bottom-0 after:inset-x-0 after:h-0.5 after:bg-primary after:rounded-t`
  - Inactive: `text-muted-foreground hover:text-foreground`

### ReplyCard
- Replace raw `div` with `<Card>`
- Target handle: `font-semibold text-[14px]`
- Meta (likes, date): `text-[12px] text-muted-foreground`
- Quoted post: `border-l-[3px] border-primary/40 pl-3 text-[13.5px] text-muted-foreground`
- Reason: `text-[12px] italic text-muted-foreground`
- Textarea: `bg-background font-mono text-[14px]`
- Actions: Copy → `default`, View post → `outline`, Skip → `ghost`
- Profile selector → `StyledSelect`

### TrendCard
- Replace raw `div` with `<Card>`
- Topic + `<Badge variant="accent">trending</Badge>`
- "Why now" label: `text-[12px] font-semibold text-muted-foreground uppercase tracking-wide`
- Angle body: `text-[13.5px]`
- Source link: `text-brand-text text-xs`
- Profile selector → `StyledSelect`

---

## 7. Phase 6 — Board

**Files:** `src/components/target-board.tsx`

### TargetCard
- Replace raw `div` with `<Card>`
- Handle: `font-semibold text-[14px]` + `<Badge>` (good/warn/bad already correct)
- `ScoreBar` below handle row if numeric score available
- Reason: `text-[13px] text-muted-foreground`
- Approach box: `bg-surface-2 rounded-[10px] p-3 text-[13px]`
- Profile selector → `StyledSelect`

---

## 8. Phase 7 — Performance

**Files:** `src/app/(app)/performance/page.tsx`

### Profile filter
- Replace raw `<a>` links with pill-style `ToggleGroup`:
  - Track: `bg-surface-2 rounded-full p-1 flex gap-1`
  - Active segment: `bg-card border border-border rounded-full px-3 py-1 text-[13px] font-medium shadow-sm`

### Stat header row
- `grid grid-cols-4 gap-[18px] mb-6`
- Each stat: `<Card>` with `CardContent`
  - Number: `text-[26px] font-bold tabular-nums tracking-[-0.02em]`
  - Label: `text-[12px] text-muted-foreground`
- Stats: Total Posts, Total Likes, Total Views, Avg Engagement Rate

### Weekly BarChart
- `<Card>` with `CardHeader` title "Weekly volume" + `<BarChart>` (see Section 10)
- Full-width, `height=120`

### Table
- Row hover: `hover:bg-surface-2`
- Numeric columns (Likes, Views): `tabular-nums`
- Post text: truncated to 1 line
- New "Trend" column: `<Sparkline>` (60×20) per row

---

## 9. Phase 8 — Profiles / Voice

**Files:** `src/app/(app)/profiles/page.tsx`, `src/components/profile-card.tsx`

### Page section titles
- `text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground mb-3`

### ProfileCard
- `CardHeader`: `BrandAvatar` (size `"sm"`) + `CardTitle` (handle) + `CardDescription` (niche)
- `CardContent`: seed target form
  - Input → design system `<Input>` with placeholder `@seed_account`
  - Submit → `<Button variant="accentSoft" size="sm">`
  - Seed count → `<Badge variant="secondary">`
- `OnboardingWizard`: Card-wrapped steps, section-title overlines per step

---

## 10. Phase 9 — SVG Charts

**Files:** `src/components/charts/sparkline.tsx`, `src/components/charts/bar-chart.tsx`, `src/components/charts/area-chart.tsx`

### Sparkline (`sparkline.tsx`)
- Props: `data: number[]`, `width?: number = 60`, `height?: number = 20`, `className?`
- Filled area path: `color-mix(in oklch, var(--primary) 20%, transparent)` gradient top→baseline
- Stroke line: `var(--primary)`, `strokeWidth=1.5`
- End-dot: `r=2`, `fill=var(--primary)`
- 2px inset padding; scales data min→max to viewbox
- Used in Performance table trend column

### BarChart (`bar-chart.tsx`)
- Props: `data: { label: string; value: number }[]`, `height?: number = 120`, `className?`
- Vertical bars, `rx=3` (rounded top)
- Resting fill: `color-mix(in oklch, var(--primary) 30%, transparent)`
- Hover fill: `var(--primary)` (via React `useState` hover tracking)
- 4px gap between bars
- X-axis labels: `fontSize=11`, `fill=var(--muted-foreground)`
- Used in Performance weekly volume card

### AreaChart (`area-chart.tsx`)
- Props: `data: { x: string; y: number }[]`, `height?: number = 180`, `className?`
- Gradient filled area (same as Sparkline fill, taller)
- 3–4 dashed horizontal gridlines: `stroke=var(--border)`, `strokeDasharray="4 4"`
- X-axis labels at first, last, and midpoints
- Vertical crosshair on hover: tracks `onMouseMove` → SVG coordinate transform → `useState` for x position
- Floating tooltip: `bg-card border border-border rounded-[8px] px-2.5 py-1.5 text-[12px] shadow-elev`
- Width: wrapping `<div>` gets a `ref`; a `ResizeObserver` on that ref stores container width in `useState`; SVG `width` attribute is set from that state (falls back to 600 on first render)
- Used in Performance main timeline chart

---

## 11. File Change Summary

### Modified files
| File | Change |
|---|---|
| `src/components/ui/card.tsx` | Padding 20px, CardTitle font |
| `src/components/ui/tabs.tsx` | Line variant accent underline + active text color |
| `src/components/ui/input.tsx` | bg-background, accent focus ring |
| `src/components/ui/textarea.tsx` | bg-background, accent focus ring |
| `src/components/cockpit/cockpit-tile.tsx` | Card component, emoji container |
| `src/components/cockpit/research-tile.tsx` | Card, BrandAvatar icon, Skeleton loading |
| `src/components/shell/sidebar.tsx` | BrandAvatar replaces hardcoded gradient |
| `src/app/(app)/engage/page.tsx` | Tabs component for tab bar |
| `src/components/reply-queue.tsx` | Card, quoted tweet accent border, StyledSelect |
| `src/components/trend-radar.tsx` | Card, StyledSelect |
| `src/components/target-board.tsx` | Card, ScorePill/ScoreBar, StyledSelect |
| `src/components/weekly-composer.tsx` | Card, Skeleton loading, StyledSelect |
| `src/components/thread-composer.tsx` | Card, connector line, StyledSelect |
| `src/app/(app)/performance/page.tsx` | Stat chips, ToggleGroup filter, BarChart, Sparkline column |
| `src/app/(app)/profiles/page.tsx` | Section title overlines |
| `src/components/profile-card.tsx` | CardHeader/CardContent, BrandAvatar, Input, Badge |

### New files
| File | Component |
|---|---|
| `src/components/ui/select-native.tsx` | `StyledSelect` |
| `src/components/ui/skeleton.tsx` | `Skeleton`, `SkeletonLine`, `SkeletonBlock` |
| `src/components/ui/brand-avatar.tsx` | `BrandAvatar` |
| `src/components/ui/score-bar.tsx` | `ScorePill`, `ScoreBar` |
| `src/components/charts/sparkline.tsx` | `Sparkline` |
| `src/components/charts/bar-chart.tsx` | `BarChart` |
| `src/components/charts/area-chart.tsx` | `AreaChart` |
