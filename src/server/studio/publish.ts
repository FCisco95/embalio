"use server";
import { supabaseService } from "@/lib/supabase/server";
import { uploadVideo } from "@/lib/youtube";
import { revalidatePath } from "next/cache";
import { unlink } from "node:fs/promises";

export async function isYouTubeConnected(profileId: string): Promise<boolean> {
  const sb = supabaseService();
  const { data } = await sb
    .from("youtube_credentials")
    .select("profile_id")
    .eq("profile_id", profileId)
    .maybeSingle();
  return !!data;
}

/**
 * Publish a recorded take. `filePath` is a server-readable path; the Publish panel
 * uploads the MP4 to a temp path first (Task 15) and passes that here.
 */
export async function publishProjectVideo(
  projectId: string,
  filePath: string,
  origin: string,
) {
  const sb = supabaseService();
  const { data: project } = await sb
    .from("video_projects")
    .select("*")
    .eq("id", projectId)
    .single();
  if (!project) throw new Error("project not found");
  if (project.stage !== "publish") throw new Error("project is not at the publish stage");
  const script = project.script as { title?: string; hook?: string } | null;

  const { data: cred } = await sb
    .from("youtube_credentials")
    .select("*")
    .eq("profile_id", project.profile_id)
    .maybeSingle();
  if (!cred) throw new Error("YouTube not connected — connect first");

  // Always remove the uploaded temp file, whether the upload succeeds or throws,
  // so recorded videos don't accumulate in the OS temp dir.
  let result;
  try {
    result = await uploadVideo({
      refreshToken: cred.refresh_token,
      filePath,
      title: script?.title ?? "Untitled",
      description: script?.hook ?? "",
      redirectUri: `${origin}/api/youtube/oauth/callback`,
    });
  } finally {
    await unlink(filePath).catch(() => {});
  }

  // Publishing is the last automated step before repurposing, so advance the
  // stage to 'repurposed' here — otherwise the Repurpose panel is never reached.
  const { error } = await sb
    .from("video_projects")
    .update({
      stage: "repurposed",
      publish: {
        youtube_video_id: result.videoId,
        url: result.url,
        privacy_status: result.privacyStatus,
        published_at: new Date().toISOString(),
      } as never,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);
  if (error) throw new Error(error.message);
  revalidatePath("/studio");
  return result;
}
