"use server";
import { supabaseServer } from "@/lib/supabase/server";
import { sendTelegram } from "@/lib/telegram";
import { getStreak } from "@/server/streak";
import { evaluateNudge, DEFAULT_NUDGE, type NudgeState } from "@/lib/nudge";
import { localDate } from "@/lib/retention/date";
import type { Json } from "@/lib/supabase/types";

export async function runNudge(profileId: string): Promise<{ sent: boolean; error?: string }> {
  try {
    const sb = await supabaseServer();
    const { data: profile } = await sb.from("profiles").select("retention").eq("id", profileId).single();
    const retention = (profile?.retention ?? {}) as { nudge?: Partial<NudgeState> };
    const prev: NudgeState = { ...DEFAULT_NUDGE, ...(retention.nudge ?? {}) };

    const now = new Date();
    const today = localDate(now);
    const yDate = new Date(now);
    yDate.setDate(yDate.getDate() - 1);
    const yesterday = localDate(yDate);

    const { data: posts } = await sb.from("posts").select("posted_at").eq("profile_id", profileId);
    const days = new Set(
      (posts ?? [])
        .map((p: { posted_at: string | null }) => p.posted_at)
        .filter((d): d is string => d != null)
        .map((iso) => localDate(new Date(iso))),
    );

    const streakCurrent = await getStreak(profileId);

    const result = evaluateNudge(prev, {
      today, yesterday, hour: now.getHours(),
      hadActionToday: days.has(today), hadActionYesterday: days.has(yesterday), streakCurrent,
    });

    if (result.send && result.text) await sendTelegram(result.text);

    await sb.from("profiles").update({ retention: { ...retention, nudge: result.nudge } as unknown as Json }).eq("id", profileId);
    return { sent: result.send };
  } catch (err) {
    console.error("runNudge failed:", String(err).slice(0, 200));
    return { sent: false, error: String(err).slice(0, 200) };
  }
}
