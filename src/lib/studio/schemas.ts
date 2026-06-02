import { z } from "zod";

export const STUDIO_STAGES = ["topic", "script", "record", "publish", "repurposed"] as const;
export type StudioStage = (typeof STUDIO_STAGES)[number];

export const TrendSignal = z.object({
  source: z.enum(["hackernews", "apify-x", "github-trending"]),
  id: z.string(),
  title: z.string(),
  url: z.string(),
  score: z.number().optional(),
  comments: z.number().optional(),
  createdAt: z.string().optional(),
});
export type TrendSignal = z.infer<typeof TrendSignal>;

export const RankedTopic = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(120),
  angle: z.string().min(1).max(400),
  score: z.number().min(0).max(100),
  rationale: z.string().min(1).max(600),
  sourceRefs: z.array(z.string()).default([]),
});
export type RankedTopic = z.infer<typeof RankedTopic>;

export const RankedTopicList = z.object({ topics: z.array(RankedTopic).min(1).max(10) });
export type RankedTopicList = z.infer<typeof RankedTopicList>;

export const ScriptBeat = z.object({
  id: z.string().min(1),
  say: z.string().min(1).max(600),
  visualPrompt: z.string().min(1).max(400),
  estSeconds: z.number().min(1).max(120).optional(),
});
export type ScriptBeat = z.infer<typeof ScriptBeat>;

export const VideoScript = z.object({
  title: z.string().min(1).max(120),
  hook: z.string().min(1).max(400),
  beats: z.array(ScriptBeat).min(1).max(40),
});
export type VideoScript = z.infer<typeof VideoScript>;

export const RecordingState = z.object({
  recording_profile_id: z.string().nullable().default(null),
  take_confirmed_at: z.string().nullable().default(null),
  notes: z.string().default(""),
});
export type RecordingState = z.infer<typeof RecordingState>;

export const PublishState = z.object({
  youtube_video_id: z.string(),
  url: z.string(),
  privacy_status: z.string(),
  published_at: z.string(),
});
export type PublishState = z.infer<typeof PublishState>;
