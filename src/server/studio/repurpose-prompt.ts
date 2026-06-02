import type { VideoScript } from "@/lib/studio/schemas";

export function buildVideoThreadPrompt(
  voiceSystem: string,
  video: { title: string; url: string; beats: VideoScript["beats"] },
): string {
  const beatLines = video.beats.map((b, i) => `${i + 1}. ${b.say}`).join("\n");
  return [
    voiceSystem,
    `Repurpose this just-published YouTube video into an X thread that drives views to it.`,
    `Video title: ${video.title}`,
    `Video URL: ${video.url}`,
    `The video's beats (teleprompter lines):\n${beatLines}`,
    `Write a tight thread: a scroll-stopping hook tweet, 2-5 body tweets distilling the most valuable beats, and a final CTA tweet linking the video (${video.url}).`,
    `Each tweet <=280 chars. Respond as JSON: { tweets: { tweet, type }[] } where type is "hook" | "body" | "cta".`,
  ].join("\n\n");
}
