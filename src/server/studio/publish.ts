"use server";
import { supabaseService } from "@/lib/supabase/server";
import { uploadVideo } from "@/lib/youtube";
import { revalidatePath } from "next/cache";

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

  const result = await uploadVideo({
    refreshToken: cred.refresh_token,
    filePath,
    title: script?.title ?? "Untitled",
    description: script?.hook ?? "",
    redirectUri: `${origin}/api/youtube/oauth/callback`,
  });

  const { error } = await sb
    .from("video_projects")
    .update({
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
