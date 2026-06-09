"use server";
import { supabaseServer } from "@/lib/supabase/server";
import { getTelegramUpdates, answerCallbackQuery } from "@/lib/telegram";
import { parseCallback, type ParsedCallback } from "@/lib/telegram-callback";
import { markRepliedQuick, dismissCandidate } from "@/server/posts";
import type { Json } from "@/lib/supabase/types";

/** Apply one parsed tap. Idempotent: only a still-surfaced candidate is acted on. */
export async function applyCallback(profileId: string, c: ParsedCallback): Promise<void> {
  const sb = await supabaseServer();
  const { data: cand } = await sb.from("candidates").select("status").eq("id", c.candidateId).single();
  if (!cand || cand.status !== "surfaced") return;

  if (c.action === "skip") {
    await dismissCandidate(c.candidateId);
    return;
  }
  // posted → reuse the candidate's latest reply draft as a URL-less reply log.
  const { data: drafts } = await sb
    .from("drafts").select("id, body")
    .eq("candidate_id", c.candidateId).eq("kind", "reply")
    .order("created_at", { ascending: false }).limit(1);
  const draft = drafts?.[0];
  if (!draft) return;
  await markRepliedQuick(profileId, { draftId: draft.id as string, candidateId: c.candidateId, reply: draft.body as string });
}

/** Drain pending Telegram taps since the stored offset and apply them once each. */
export async function drainTelegramUpdates(profileId: string): Promise<{ applied: number; error?: string }> {
  try {
    const sb = await supabaseServer();
    const { data: profile } = await sb.from("profiles").select("retention").eq("id", profileId).single();
    const retention = (profile?.retention ?? {}) as { telegram?: { offset: number } };
    const offset = retention.telegram?.offset ?? 0;

    const { callbacks, nextOffset } = await getTelegramUpdates(offset);
    let applied = 0;
    for (const cb of callbacks) {
      const parsed = parseCallback(cb.data);
      if (!parsed) continue;
      await applyCallback(profileId, parsed);
      await answerCallbackQuery(cb.id, parsed.action === "posted" ? "✅ Logged" : "⏭️ Skipped");
      applied++;
    }

    if (nextOffset !== offset) {
      await sb.from("profiles").update({ retention: { ...retention, telegram: { offset: nextOffset } } as unknown as Json }).eq("id", profileId);
    }
    return { applied };
  } catch (err) {
    console.error("drainTelegramUpdates failed:", String(err).slice(0, 200));
    return { applied: 0, error: String(err).slice(0, 200) };
  }
}
