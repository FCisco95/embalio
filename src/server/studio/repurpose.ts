"use server";
import { supabaseService } from "@/lib/supabase/server";
import { generateStructured } from "@/lib/generate";
import { ThreadDraft } from "@/lib/schemas";
import { buildVoiceSystemFromSpec } from "@/lib/voice-prompt";
import { saveDraftToQueue } from "@/server/posts";
import type { VideoScript } from "@/lib/studio/schemas";
import { buildVideoThreadPrompt } from "./repurpose-prompt";

/** Generate an X thread from a published project and drop it into the existing sign-off queue. */
export async function createXThreadFromVideo(projectId: string): Promise<{ draftId: string; tweetCount: number }> {
  const sb = supabaseService();
  const { data: project } = await sb.from("video_projects").select("*").eq("id", projectId).single();
  if (!project) throw new Error("project not found");
  const script = project.script as VideoScript | null;
  const publish = project.publish as { url?: string } | null;
  if (!script) throw new Error("no script to repurpose");
  if (!publish?.url) throw new Error("publish the video before repurposing");

  const { data: profile } = await sb.from("profiles").select("*").eq("id", project.profile_id).single();
  const voiceSystem = profile ? buildVoiceSystemFromSpec(profile) : "";

  const r = await generateStructured(
    ThreadDraft,
    buildVideoThreadPrompt(voiceSystem, { title: script.title, url: publish.url, beats: script.beats }),
  );
  if (!r.data) throw new Error("could not draft the thread — try again");

  // Reuse the existing queue seam: store the thread as one 'original' draft (tweets joined),
  // matching how Create-a-Post persists multi-tweet originals.
  const body = r.data.tweets.map((t) => t.tweet).join("\n\n");
  const draftId = await saveDraftToQueue(project.profile_id, { kind: "original", body });

  await sb
    .from("video_projects")
    .update({ stage: "repurposed", updated_at: new Date().toISOString() })
    .eq("id", projectId);

  return { draftId, tweetCount: r.data.tweets.length };
}
