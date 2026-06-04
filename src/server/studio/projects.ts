"use server";
import { supabaseService } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { withRetry } from "@/lib/retry";
import { collectTrendSignals } from "@/lib/studio/signals";
import { brain } from "@/lib/studio/brain";
import { ChannelPlaybook, VideoScript } from "@/lib/studio/schemas";
import type { StudioStage, RankedTopic } from "@/lib/studio/schemas";
import { beatsFromProject } from "./overlay-data";
import { buildVoiceSystemFromSpec } from "@/lib/voice-prompt";
import { assertTransition, mergeProjectPatch } from "./project-helpers";

export async function listVideoProjects(profileId: string) {
  const sb = supabaseService();
  const { data, error } = await sb
    .from("video_projects")
    .select("*")
    .eq("profile_id", profileId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createVideoProject(profileId: string) {
  const sb = supabaseService();
  const { data, error } = await sb
    .from("video_projects")
    .insert({ profile_id: profileId, stage: "topic" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/studio");
  return data;
}

/** Stage 1: pull live signals + rank topics for the niche. Does NOT advance. */
export async function rankTopicsForProject(profileId: string): Promise<RankedTopic[]> {
  const sb = supabaseService();
  const { data: profile } = await sb.from("profiles").select("*").eq("id", profileId).single();
  const voiceSpec = profile ? buildVoiceSystemFromSpec(profile) : undefined;
  const niche = profile?.niche_description?.trim() || "a vibe-coder who builds on blockchain and builds in public";
  const playbook = playbookFrom(profile);
  const signals = await withRetry(() => collectTrendSignals({ limit: 25 }));
  return brain.rankTopics({ niche, voiceSpec, signals, count: 6, playbook });
}

/** Human pick gate: store the chosen topic and advance to 'script'. */
export async function chooseTopic(projectId: string, topic: RankedTopic) {
  return updateProject(projectId, "topic", "script", { topic: topic as never });
}

/** Stage 2: write the script from the chosen topic. Keeps stage at 'script'. */
export async function writeScriptForProject(projectId: string): Promise<VideoScript> {
  const sb = supabaseService();
  const { data: project } = await sb.from("video_projects").select("*").eq("id", projectId).single();
  if (!project?.topic) throw new Error("choose a topic first");
  const { data: profile } = await sb.from("profiles").select("*").eq("id", project.profile_id).single();
  const voiceSpec = profile ? buildVoiceSystemFromSpec(profile) : undefined;
  const playbook = playbookFrom(profile);
  const script = await brain.writeScript({ topic: project.topic as RankedTopic, voiceSpec, playbook });
  await patchProject(projectId, { script: script as never });
  return script;
}

/** Save edits to the script (from Script Studio). */
export async function saveScript(projectId: string, script: VideoScript) {
  await patchProject(projectId, { script: script as never });
}

export async function advanceToRecord(projectId: string) {
  return updateProject(projectId, "script", "record", {});
}

export async function confirmTake(projectId: string, recordingProfileId: string, notes = "") {
  return updateProject(projectId, "record", "publish", {
    recording: { recording_profile_id: recordingProfileId, take_confirmed_at: new Date().toISOString(), notes } as never,
  });
}

// --- internals ---

async function patchProject(projectId: string, patch: Record<string, unknown>) {
  const sb = supabaseService();
  const { error } = await sb
    .from("video_projects")
    .update(mergeProjectPatch(patch, new Date().toISOString()) as never)
    .eq("id", projectId);
  if (error) throw new Error(error.message);
  revalidatePath("/studio");
}

async function updateProject(projectId: string, from: StudioStage, to: StudioStage, patch: Record<string, unknown>) {
  assertTransition(from, to);
  // Guard against out-of-order/stale calls: the row must actually be at `from`.
  const sb = supabaseService();
  const { data: current } = await sb.from("video_projects").select("stage").eq("id", projectId).single();
  if (current && current.stage !== from) {
    throw new Error(`project is at "${current.stage}", not "${from}"`);
  }
  await patchProject(projectId, { ...patch, stage: to });
}

function playbookFrom(profile: { channel_playbook?: unknown } | null) {
  if (!profile?.channel_playbook) return undefined;
  const parsed = ChannelPlaybook.safeParse(profile.channel_playbook);
  return parsed.success ? parsed.data : undefined;
}

/** Load a project + its recording profiles for the overlay cockpit. */
export async function getProjectForOverlay(projectId: string) {
  const sb = supabaseService();
  const { data: project, error } = await sb.from("video_projects").select("*").eq("id", projectId).single();
  if (error) throw new Error(error.message);
  const script = beatsFromProject(project);
  const { data: profiles } = await sb
    .from("recording_profiles")
    .select("*")
    .eq("profile_id", project.profile_id);
  return { project, script, recordingProfiles: profiles ?? [] };
}
