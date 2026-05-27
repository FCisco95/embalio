"use server";
import { supabaseServer } from "@/lib/supabase/server";
import { generateText, generateStructured } from "@/lib/generate";
import { ReplyCandidateList, ReplyDraft, ReplyQueue, ReplyOpportunity } from "@/lib/schemas";
import {
  buildCiscoContextBlock,
  buildSeedScanPrompt,
  buildReplyFilterPrompt,
  buildReplyDraftPrompt,
  buildVoiceSystemFromSpec,
} from "@/lib/voice-prompt";
import { readHandoff } from "@/lib/handoff-reader";

export async function generateReplyQueue(profileId: string, handleOverride?: string[]): Promise<ReplyQueue> {
  const sb = await supabaseServer();

  // Step 1: Load profile context
  const { data: profile, error } = await sb
    .from("profiles")
    .select("handle, voice_spec, content_pillars")
    .eq("id", profileId)
    .single();
  if (error || !profile) throw new Error("profile not found");

  // Load seed handles (from DB or caller override for testing)
  let handles: string[] = handleOverride ?? [];
  if (!handleOverride) {
    const { data: seeds } = await sb
      .from("seed_targets")
      .select("handle")
      .eq("profile_id", profileId)
      .eq("active", true);
    handles = (seeds ?? []).map((s) => s.handle).filter((h): h is string => Boolean(h));
  }

  if (handles.length === 0) throw new Error("no seed accounts found — run onboarding first");

  const handoffText = await readHandoff();
  const date = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const ciscoContext = buildCiscoContextBlock(
    { handle: profile.handle, voice_spec: profile.voice_spec, content_pillars: profile.content_pillars as string[] },
    handoffText
  );
  const voiceSystem = buildVoiceSystemFromSpec({ handle: profile.handle, voice_spec: profile.voice_spec });

  // Step 2: Scan recent posts from seed accounts
  const scannedPosts = await generateText(buildSeedScanPrompt(handles, date), { research: true });

  // Step 3: Filter to reply-worthy opportunities
  const filter = await generateStructured(
    ReplyCandidateList,
    buildReplyFilterPrompt(scannedPosts, ciscoContext)
  );
  if (!filter.data || filter.data.opportunities.length === 0) {
    return { generatedAt: date, opportunities: [] };
  }

  // Step 4: Draft replies in parallel
  const draftResults = await Promise.all(
    filter.data.opportunities.map((opp) =>
      generateStructured(ReplyDraft, buildReplyDraftPrompt(voiceSystem, opp))
    )
  );

  // Step 5: Assemble — skip entries where model returned skip:true or no reply
  const opportunities: ReplyOpportunity[] = [];
  for (let i = 0; i < filter.data.opportunities.length; i++) {
    const draft = draftResults[i].data;
    if (!draft || draft.skip || !draft.reply) continue;
    opportunities.push({ ...filter.data.opportunities[i], reply: draft.reply });
  }

  return { generatedAt: date, opportunities };
}
