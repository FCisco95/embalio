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
