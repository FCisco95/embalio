"use server";
import { supabaseServer, supabaseService } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { StrategySnapshot } from "@/lib/strategy/schemas";
import { assertOwnProfile } from "@/server/auth";

export type StrategyBoardResult = { ok: true; snapshot: StrategySnapshot | null } | { ok: false; error: string };

export async function getStrategyBoard(profileId: string): Promise<StrategyBoardResult> {
  try {
    await assertOwnProfile(profileId);
    const sb = supabaseService();
    const { data } = await sb
      .from("strategy_snapshots").select("snapshot_json")
      .eq("profile_id", profileId).order("week_of", { ascending: false }).limit(1).maybeSingle();
    return { ok: true, snapshot: (data?.snapshot_json as StrategySnapshot) ?? null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "failed to load strategy" };
  }
}

export type ApplyResult = { ok: true; added: number; dropped: number } | { ok: false; error: string };

/** HUMAN-IN-THE-LOOP: mutates seed_targets ONLY for the explicit handles the user approved. Never auto-called. */
export async function applyTargetRecommendation(
  profileId: string,
  decision: { adds: string[]; drops: string[] },
): Promise<ApplyResult> {
  try {
    if (!decision.adds.length && !decision.drops.length) return { ok: false, error: "nothing to apply" };
    await assertOwnProfile(profileId);
    const sb = await supabaseServer();
    if (decision.adds.length) {
      await sb.from("seed_targets").upsert(
        decision.adds.map((handle) => ({ profile_id: profileId, handle, active: true })),
        { onConflict: "profile_id,handle" },
      );
    }
    if (decision.drops.length) {
      await sb.from("seed_targets").update({ active: false })
        .eq("profile_id", profileId).in("handle", decision.drops);
    }
    revalidatePath("/board");
    return { ok: true, added: decision.adds.length, dropped: decision.drops.length };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "apply failed" };
  }
}
