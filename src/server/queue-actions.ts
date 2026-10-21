"use server";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { bodyHasUrl, extractTrailingLink } from "@/lib/posting/link-rule";
import { publishDraft } from "@/server/publish";

// Approval-queue Server Actions. All reads/writes go through `supabaseServer()`
// (session + RLS): a draft the caller does not own is simply invisible, which is
// the ownership proof. Publishing itself runs service-role inside `publishDraft`.

type ActionResult = { ok: true } | { ok: false; error: string };

const OPEN_STATUSES = ["draft", "approved", "scheduled"];
const URL_IN_BODY_ERROR = "remove the URL from the tweet body; only a trailing link is allowed (posted as reply 1)";
const LIMIT_STANDARD = 280;
const LIMIT_LONG_FORM = 4000;

type Sb = Awaited<ReturnType<typeof supabaseServer>>;

async function loadDraft(sb: Sb, draftId: string) {
  const { data } = await sb
    .from("drafts")
    .select("id, profile_id, kind, body, status, link_url")
    .eq("id", draftId)
    .maybeSingle();
  return data;
}

async function charLimit(sb: Sb, profileId: string): Promise<number> {
  const { data } = await sb.from("profiles").select("premium_account").eq("id", profileId).maybeSingle();
  return data?.premium_account ? LIMIT_LONG_FORM : LIMIT_STANDARD;
}

function revalidateQueue() {
  revalidatePath("/");
  revalidatePath("/compose");
}

export async function approveAndSchedule(
  draftId: string,
  scheduledAt: string | null,
): Promise<{ ok: true; published: boolean; reason?: string } | { ok: false; error: string }> {
  const sb = await supabaseServer();
  const draft = await loadDraft(sb, draftId);
  if (!draft) return { ok: false, error: "draft not found" };

  // ToS: replies are posted by the human in X's own composer, never via the API.
  if (draft.kind === "reply") return { ok: false, error: "replies are posted by hand in X's composer, not scheduled" };
  if (!OPEN_STATUSES.includes(draft.status)) return { ok: false, error: `draft is already ${draft.status}` };

  let when: string;
  if (scheduledAt === null) {
    when = new Date().toISOString();
  } else {
    const d = new Date(scheduledAt);
    if (Number.isNaN(d.getTime())) return { ok: false, error: "invalid date/time" };
    when = d.toISOString();
  }

  // Reach rule: a URL never rides in the main body. A trailing one becomes reply 1.
  const { text, link_url } = extractTrailingLink(draft.body);
  const body = text.trim();
  if (!body) return { ok: false, error: "draft body is empty" };
  if (bodyHasUrl(body)) return { ok: false, error: URL_IN_BODY_ERROR };
  const limit = await charLimit(sb, draft.profile_id);
  if (body.length > limit) return { ok: false, error: `body is ${body.length} characters, the limit is ${limit}` };

  const { data: updated, error } = await sb
    .from("drafts")
    .update({ body, link_url: link_url ?? draft.link_url, status: "scheduled", scheduled_at: when })
    .eq("id", draftId)
    .in("status", OPEN_STATUSES)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!updated || updated.length === 0) return { ok: false, error: "draft changed state, refresh and retry" };

  let published = false;
  let reason: string | undefined;
  if (scheduledAt === null) {
    // Fast path. A failure leaves it 'scheduled' for the publish-due ticker; surface why.
    const out = await publishDraft(draftId);
    published = out.ok;
    if (!out.ok) reason = out.reason;
  }
  revalidateQueue();
  return reason === undefined ? { ok: true, published } : { ok: true, published, reason };
}

export async function editDraftBody(draftId: string, body: string): Promise<ActionResult> {
  const sb = await supabaseServer();
  const draft = await loadDraft(sb, draftId);
  if (!draft) return { ok: false, error: "draft not found" };
  if (!OPEN_STATUSES.includes(draft.status)) return { ok: false, error: `draft is already ${draft.status}` };

  // Same link rule as approveAndSchedule, so the UI counter, the save and the publish agree
  // (and a URL can never reach a scheduled draft, where publishDraft would refuse it).
  const { text, link_url } = extractTrailingLink(body.trim());
  const lifted = text.trim();
  if (!lifted) return { ok: false, error: "draft body is empty" };
  if (bodyHasUrl(lifted)) return { ok: false, error: URL_IN_BODY_ERROR };
  const limit = await charLimit(sb, draft.profile_id);
  if (lifted.length > limit) return { ok: false, error: `body is ${lifted.length} characters, the limit is ${limit}` };

  const { data: updated, error } = await sb
    .from("drafts")
    .update({ body: lifted, link_url: link_url ?? draft.link_url })
    .eq("id", draftId)
    .in("status", OPEN_STATUSES)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!updated || updated.length === 0) return { ok: false, error: "draft changed state, refresh and retry" };
  revalidateQueue();
  return { ok: true };
}

/** Drop the stored link (reply 1) from a draft the caller owns. The nightly job can leave a wrong one. */
export async function clearDraftLink(draftId: string): Promise<ActionResult> {
  const sb = await supabaseServer();
  const draft = await loadDraft(sb, draftId);
  if (!draft) return { ok: false, error: "draft not found" };
  if (!OPEN_STATUSES.includes(draft.status)) return { ok: false, error: `draft is already ${draft.status}` };

  const { data: updated, error } = await sb
    .from("drafts")
    .update({ link_url: null })
    .eq("id", draftId)
    .in("status", OPEN_STATUSES)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!updated || updated.length === 0) return { ok: false, error: "draft changed state, refresh and retry" };
  revalidateQueue();
  return { ok: true };
}

export async function skipDraft(draftId: string): Promise<ActionResult> {
  const sb = await supabaseServer();
  const { data: updated, error } = await sb
    .from("drafts")
    .update({ status: "skipped" })
    .eq("id", draftId)
    .in("status", OPEN_STATUSES)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!updated || updated.length === 0) return { ok: false, error: "draft not found or already finished" };
  revalidateQueue();
  return { ok: true };
}

export async function unscheduleDraft(draftId: string): Promise<ActionResult> {
  const sb = await supabaseServer();
  const { data: updated, error } = await sb
    .from("drafts")
    .update({ status: "approved", scheduled_at: null })
    .eq("id", draftId)
    .eq("status", "scheduled")
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!updated || updated.length === 0) return { ok: false, error: "draft is not scheduled" };
  revalidateQueue();
  return { ok: true };
}
