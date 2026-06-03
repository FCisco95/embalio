import { supabaseService } from "@/lib/supabase/server";
import { scanTargetsForProfile, draftRepliesForProfile } from "@/server/targeting";
import { sendTelegram } from "@/lib/telegram";

const DEFAULT_LIMIT = 5;

export interface PulseResult {
  surfaced: number;
  drafted: number;
  sent: number;
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * The apex loop: refresh reply opportunities, then push the top ones to Telegram
 * with a ready-to-post comment + action buttons.
 *
 * LOCAL-only — `refresh` runs `claude` drafting, which can't run on Vercel. Fire
 * it from a local launchd job hitting /api/pulse while `npm run dev` is up.
 */
export async function runPulse(
  profileId: string,
  opts: { limit?: number; refresh?: boolean } = {},
): Promise<PulseResult> {
  const limit = opts.limit ?? DEFAULT_LIMIT;

  let surfaced = 0;
  let drafted = 0;
  if (opts.refresh ?? true) {
    surfaced = await scanTargetsForProfile(profileId);
    drafted = await draftRepliesForProfile(profileId);
  }

  const sb = supabaseService();
  // Top surfaced opportunities by score; over-fetch since some lack a drafted reply.
  const { data: cands } = await sb
    .from("candidates")
    .select("id, author_handle, tweet_text, tweet_url, score_composite")
    .eq("profile_id", profileId)
    .eq("status", "surfaced")
    .order("score_composite", { ascending: false })
    .limit(limit * 2);

  let sent = 0;
  for (const c of cands ?? []) {
    if (sent >= limit) break;
    const { data: drafts } = await sb
      .from("drafts")
      .select("body")
      .eq("candidate_id", c.id)
      .eq("kind", "reply")
      .order("created_at", { ascending: false })
      .limit(1);
    const comment = drafts?.[0]?.body;
    if (!comment) continue; // no pre-written reply yet — skip until drafted

    // Comment wrapped in <code> so a single tap on mobile copies it to clipboard.
    const text = [
      `🎯 <b>${escapeHtml(c.author_handle)}</b>`,
      "",
      escapeHtml(truncate(c.tweet_text, 240)),
      "",
      "💬 <b>Your reply</b> — tap to copy:",
      `<code>${escapeHtml(comment)}</code>`,
      "",
      escapeHtml(c.tweet_url),
    ].join("\n");

    await sendTelegram(text, {
      parseMode: "HTML",
      buttons: [[
        { text: "✅ Posted", data: `posted:${c.id}` },
        { text: "⏭️ Skip", data: `skip:${c.id}` },
      ]],
    });
    sent++;
  }

  return { surfaced, drafted, sent };
}
