/**
 * Representative dashboard data for the presentational cards (reach hero,
 * strategy-of-the-week, top post, today's targets).
 *
 * The real app's analytics are sparse / generated on-demand, and the Dispatch
 * prototype this design is ported from is itself seed-data — so these values
 * give the command center its intended "loaded" look. Swap for live analytics
 * once per-post metrics are reliably populated.
 */

import type { PlatformId } from "@/lib/brand"

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export function formatCount(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + "M"
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + "K"
  return String(n)
}

export const REACH = {
  total: 312400,
  delta: 18.4,
  platforms: 4,
  series: [28, 31, 26, 42, 51, 47, 63].map((v, i) => ({ x: DAYS[i], y: v * 1000 })),
}

export const STRATEGY = {
  title: "Lead with the failure, land on the lesson",
  body: "Your 3 highest-reach posts this month all opened with something that went wrong. Vulnerability-first openers are getting 3.1× the saves of your tip posts. Lean in this week.",
  lift: "+210% saves",
}

export const TOP_POST = {
  text: "i almost shut this project down in march. today it crossed $5k MRR. nothing changed except i stopped trying to be impressive and started being useful. that's the whole post.",
  platform: "x" as PlatformId,
  likes: 4820,
  reposts: 612,
  replies: 388,
  views: 284000,
  er: 6.2,
  when: "2 days ago",
}

export interface SeedTarget {
  id: string
  author: string
  handle: string
  platform: PlatformId
  text: string
  score: number
  postedAgo: string
}

export const TARGETS: SeedTarget[] = [
  {
    id: "t1",
    author: "@swyx",
    handle: "swyx",
    platform: "x",
    text: "hot take: 'build in public' is mostly survivorship bias. the ones who quietly failed aren't tweeting.",
    score: 94,
    postedAgo: "22m",
  },
  {
    id: "t2",
    author: "@levelsio",
    handle: "levelsio",
    platform: "x",
    text: "shipped 4 features this week. 3 were bad. 1 doubled signups. you can't know which in advance, so just ship.",
    score: 91,
    postedAgo: "1h",
  },
  {
    id: "t3",
    author: "@dvassallo",
    handle: "dvassallo",
    platform: "x",
    text: "revenue is a lagging indicator of how useful you've been. stop optimizing the number, optimize the usefulness.",
    score: 88,
    postedAgo: "2h",
  },
]
