import { supabaseService } from "@/lib/supabase/server"
import type { Json } from "@/lib/supabase/types"

const DEFAULT_PROFILE_ID = process.env.FIXED_PROFILE_ID!

/** Raw research payload cached per day and consumed by the weekly synthesis step. */
export interface ResearchData {
  xTopics: string
  github: string
  news: string
}

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
export async function getWeeklyBriefing(
  date: string,
  profileId: string = DEFAULT_PROFILE_ID,
): Promise<Briefing | null> {
  const sb = supabaseService()
  const { data } = await sb
    .from("research_briefings")
    .select("*")
    .eq("profile_id", profileId)
    .eq("date", date)
    .single()
  return (data as Briefing) ?? null
}

/**
 * Return today's cached briefing, or run `research` once and cache it.
 *
 * Idempotent and concurrency-safe: the cache check short-circuits re-runs, and
 * the write upserts on (profile_id, date) so racing callers converge on one row.
 * The expensive web-research `research()` callback only fires on a cache miss —
 * which is the whole point: research runs once/day, every later run is instant.
 */
export async function runWeeklyBriefing(
  date: string,
  research: () => Promise<ResearchData>,
  profileId: string = DEFAULT_PROFILE_ID,
): Promise<Briefing> {
  const cached = await getWeeklyBriefing(date, profileId)
  if (cached) return cached

  const data = await research()
  const summary = [data.xTopics, data.github, data.news]
    .map((s) => s.trim())
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 1000)

  const sb = supabaseService()
  const { data: row, error } = await sb
    .from("research_briefings")
    .upsert(
      { profile_id: profileId, date, summary, topics: [], raw_data: data as unknown as Json },
      { onConflict: "profile_id,date" },
    )
    .select()
    .single()

  if (error) throw new Error(`Failed to store briefing: ${error.message}`)
  return row as Briefing
}
