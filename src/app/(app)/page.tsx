import Link from "next/link"
import {
  Plus,
  TrendingUp,
  ArrowUp,
  ArrowDown,
  Eye,
  Sparkles,
  Zap,
  Flame,
  Heart,
  Repeat2,
  Reply,
  Check,
  CheckCircle2,
  SquarePen,
  Target,
} from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { BrandAvatar, BRAND_GRADIENT } from "@/components/ui/brand-avatar"
import { PersonAvatar } from "@/components/ui/person-avatar"
import { PlatformGlyph } from "@/components/ui/platform-glyph"
import { ScorePill } from "@/components/ui/score-bar"
import { AreaChart } from "@/components/charts/area-chart"
import { cn } from "@/lib/utils"
import { BRAND } from "@/lib/brand"
import { formatCount } from "@/lib/format"
import { redirect } from "next/navigation"
import { needsSetup } from "@/lib/setup-logic"
import { listProfiles } from "@/server/profiles"
import { listPendingDrafts } from "@/server/posts"
import { getDashboardData, type DashboardData } from "@/server/dashboard"
import { getGrowthPlan } from "@/server/growth-plan"
import { getDailyAssignment } from "@/server/coach"
import { getStreak } from "@/server/streak"
import { getFollowerStat } from "@/server/kpis"
import { GrowthPlanCard } from "@/components/growth-plan-card"
import { CoachCard } from "@/components/coach-card"
import { FollowerCard } from "@/components/follower-card"
import { StreakBadge } from "@/components/streak-badge"

const CARD = "rounded-xl border border-border bg-card"

const EMPTY_DASHBOARD: DashboardData = {
  reach: { total: 0, delta: null, series: [] },
  topPost: null,
  strategy: null,
  targets: [],
}

export default async function DashboardPage() {
  let handle = BRAND.handle
  let pending: Awaited<ReturnType<typeof listPendingDrafts>> = []
  let data: DashboardData = EMPTY_DASHBOARD
  let growthPlan: Awaited<ReturnType<typeof getGrowthPlan>> = null
  let assignment: Awaited<ReturnType<typeof getDailyAssignment>> | null = null
  let streak = 0
  let followerStat: Awaited<ReturnType<typeof getFollowerStat>> = null
  try {
    const profiles = await listProfiles()
    const profile = profiles?.[0]
    if (needsSetup(profile)) redirect("/setup")
    if (profile?.handle) handle = profile.handle.startsWith("@") ? profile.handle : `@${profile.handle}`
    if (profile?.id) {
      pending = await listPendingDrafts(profile.id)
      data = await getDashboardData(profile.id)
      growthPlan = await getGrowthPlan(profile.id)
      assignment = await getDailyAssignment(profile.id)
      streak = await getStreak(profile.id)
      followerStat = await getFollowerStat(profile.id)
    }
  } catch (e) {
    // Let Next.js redirects propagate; only swallow real DB errors.
    if (e && typeof e === "object" && "digest" in e && String((e as { digest?: string }).digest).startsWith("NEXT_REDIRECT")) {
      throw e
    }
    // Render with empty states if the DB is unavailable.
  }

  const { reach, topPost, strategy, targets } = data
  const hasReach = reach.series.some((d) => d.y > 0)

  const hour = new Date().getHours()
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"

  return (
    <div className="mx-auto max-w-content px-[30px] pb-[60px] pt-[26px] max-md:px-4">
      {/* Header */}
      <div className="mb-[22px] flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em]">{greet}, {BRAND.name}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Running <strong className="font-semibold text-secondary-foreground">{handle}</strong>
            {pending.length
              ? ` · ${pending.length} draft${pending.length > 1 ? "s" : ""} need your sign-off`
              : " · queue is clear"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StreakBadge streak={streak} />
          <Link href="/compose" className={cn(buttonVariants({ size: "lg" }))}>
            <Plus className="size-4" strokeWidth={1.6} />
            New post
          </Link>
        </div>
      </div>

      {/* Balanced dashboard grid */}
      <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-2">
        {/* Daily coach assignment */}
        {assignment && <CoachCard assignment={assignment} />}

        {/* Follower star card (P3) */}
        <FollowerCard stat={followerStat} />

        {/* Reach hero */}
        <div
          className="rounded-xl border border-border p-6 lg:col-span-2"
          style={{
            background:
              "linear-gradient(160deg, color-mix(in oklch, var(--primary) 12%, var(--card)), var(--card) 62%)",
          }}
        >
          <div className="mb-2 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-[7px] text-[13px] font-medium text-muted-foreground">
                <TrendingUp className="size-[15px]" strokeWidth={1.6} />
                Total reach this week
              </div>
              <div className="mt-2 flex flex-wrap items-baseline gap-3">
                <div className="text-[40px] font-bold leading-none tracking-[-0.03em]">
                  {formatCount(reach.total)}
                </div>
                {reach.delta !== null && (
                  <Badge variant={reach.delta >= 0 ? "good" : "bad"}>
                    {reach.delta >= 0 ? <ArrowUp strokeWidth={2} /> : <ArrowDown strokeWidth={2} />}
                    {Math.abs(reach.delta)}% WoW
                  </Badge>
                )}
              </div>
            </div>
          </div>
          {hasReach ? (
            <AreaChart data={reach.series} height={150} />
          ) : (
            <div className="flex h-[150px] flex-col items-center justify-center gap-1 text-center text-[13px] text-muted-foreground">
              <Eye className="size-5 opacity-60" strokeWidth={1.6} />
              No reach yet — mark a post as posted and add its numbers to see this fill in.
            </div>
          )}
        </div>

        {/* Growth plan card */}
        {growthPlan && <GrowthPlanCard plan={growthPlan} />}

        {/* Strategy of the week */}
        <div
          className="rounded-xl p-[22px]"
          style={{
            background:
              "linear-gradient(155deg, color-mix(in oklch, var(--primary) 18%, var(--card)), var(--card) 70%)",
            border: "1px solid color-mix(in oklch, var(--primary) 28%, var(--border))",
          }}
        >
          <div className="mb-3 flex items-center gap-2">
            <div
              className="flex size-7 items-center justify-center rounded-lg text-brand-text"
              style={{ background: "color-mix(in oklch, var(--primary) 22%, transparent)" }}
            >
              <Sparkles className="size-4" strokeWidth={1.6} />
            </div>
            <span className="text-[12px] font-semibold uppercase tracking-[0.05em] text-brand-text">
              Strategy of the week
            </span>
            {strategy?.lift && (
              <Badge variant="accent" className="ml-auto">
                <TrendingUp strokeWidth={1.8} />
                {strategy.lift}
              </Badge>
            )}
          </div>
          {strategy ? (
            <>
              <h3 className="mb-2 text-[18px] font-bold tracking-[-0.01em]">{strategy.title}</h3>
              <p className="mb-4 text-[13.5px] leading-[1.55] text-muted-foreground">{strategy.body}</p>
            </>
          ) : (
            <p className="mb-4 text-[13.5px] leading-[1.55] text-muted-foreground">
              Once you&apos;ve posted a few originals and replies, this will surface what&apos;s
              actually working for you — no guesses.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Link href="/compose" className={cn(buttonVariants({ size: "lg" }))}>
              <Zap className="size-4" strokeWidth={1.6} />
              Apply to composer
            </Link>
            <Link href="/performance" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
              See analytics
            </Link>
          </div>
        </div>

        {/* Pending approval — real drafts */}
        <div className={cn(CARD, "p-5")}>
          <div className="mb-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[13px] font-semibold">
              <Check className="size-4" strokeWidth={1.6} />
              Pending approval
              {pending.length ? (
                <span className="inline-flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-primary px-[5px] text-[11px] font-bold text-primary-foreground">
                  {pending.length}
                </span>
              ) : null}
            </div>
            <Link href="/compose" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              Composer
            </Link>
          </div>

          {pending.length === 0 ? (
            <div className="px-2 py-6 text-center text-[13px] text-muted-foreground">
              <div className="mb-2 flex justify-center text-success">
                <CheckCircle2 className="size-6" strokeWidth={1.6} />
              </div>
              All caught up — queue is clear.
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {pending.slice(0, 3).map((d) => (
                <div key={d.id} className="rounded-xl border border-border bg-surface-2 px-3.5 py-3.5">
                  <div className="mb-2 flex items-center gap-2 text-[11.5px] text-muted-foreground">
                    <PlatformGlyph id="x" size={15} />
                    <span className="font-medium capitalize">{d.kind}</span>
                    <span>·</span>
                    <span>{new Date(d.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                  </div>
                  <p className="mb-2.5 text-[13px] leading-[1.5]">
                    {d.body.length > 130 ? d.body.slice(0, 130) + "…" : d.body}
                  </p>
                  <div className="flex gap-2">
                    <Link href="/compose" className={cn(buttonVariants({ size: "sm" }))}>
                      <Check strokeWidth={2} />
                      Approve &amp; post
                    </Link>
                    <Link href="/compose" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                      <SquarePen strokeWidth={1.8} />
                      Edit
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top post */}
        <div className={cn(CARD, "flex flex-col p-5")}>
          <div className="mb-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[13px] font-semibold">
              <Flame className="size-4 text-warning" strokeWidth={1.6} />
              Top post
            </div>
            {topPost && <Badge variant="warn">{topPost.when}</Badge>}
          </div>
          {topPost ? (
            <>
              <div className="mb-3 flex gap-2.5">
                <BrandAvatar name={BRAND.name} size={34} gradient={BRAND_GRADIENT} initials="C" />
                <div>
                  <div className="flex items-center gap-1.5 text-[13px] font-semibold">
                    {BRAND.name}
                    <PlatformGlyph id="x" size={14} />
                  </div>
                  <div className="text-[12px] text-muted-foreground">{handle}</div>
                </div>
              </div>
              <p className="mb-4 flex-1 text-[13.5px] leading-[1.55]">{topPost.body}</p>
              <div className="flex items-center gap-[18px] border-t border-border pt-3.5">
                {([
                  [Heart, topPost.likes],
                  [Repeat2, topPost.reposts],
                  [Reply, topPost.replies],
                  [Eye, topPost.views],
                ] as const).map(([Icon, v], i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground">
                    <Icon className="size-[14px]" strokeWidth={1.6} />
                    {formatCount(v)}
                  </div>
                ))}
                {topPost.er !== null && (
                  <Badge variant="accent" className="ml-auto">{topPost.er}% ER</Badge>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-1 py-8 text-center text-[13px] text-muted-foreground">
              <Flame className="size-5 opacity-60" strokeWidth={1.6} />
              Your best-performing post will show up here.
            </div>
          )}
        </div>

        {/* Today's targets */}
        <div className={cn(CARD, "p-5")}>
          <div className="mb-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[13px] font-semibold">
              <Target className="size-4" strokeWidth={1.6} />
              Today&apos;s targets
            </div>
            <Link href="/board" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              Open board
            </Link>
          </div>
          {targets.length ? (
            <div className="flex flex-col gap-1">
              {targets.map((t) => (
                <Link
                  key={t.sourceTweetId}
                  href="/board"
                  className="flex items-center gap-2.5 rounded-[10px] px-2 py-2.5 transition-colors hover:bg-surface-2"
                >
                  <PersonAvatar handle={t.handle.replace(/^@/, "")} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[12.5px] font-semibold">{t.handle}</span>
                      <PlatformGlyph id="x" size={12} />
                    </div>
                    <div className="truncate text-[12px] text-muted-foreground">{t.text}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <ScorePill value={t.score} />
                    <span className="text-[10.5px] text-muted-foreground">{t.when}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="px-2 py-6 text-center text-[13px] text-muted-foreground">
              <div className="mb-2 flex justify-center opacity-60">
                <Target className="size-6" strokeWidth={1.6} />
              </div>
              No targets surfaced yet.{" "}
              <Link href="/board" className="text-brand-text underline underline-offset-2">
                Find who to engage
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
