import { z } from "zod";

export const DraftOutput = z.object({
  body: z.string().min(1).max(280),
  suggestedVisual: z.string().max(500).optional(),
});
export type DraftOutput = z.infer<typeof DraftOutput>;

export const TweetUrl = z
  .url()
  .refine((u) => /(?:twitter|x)\.com\/[^/]+\/status\/\d+/.test(u), "not a tweet URL");

export const PersonaSynthesis = z.object({
  voiceSpec: z.string().min(1),
  contentPillars: z.array(z.string()).min(1),
  seedAccounts: z.array(z.string()).default([]),
  samplePosts: z.array(z.string()).max(3).default([]),
});
export type PersonaSynthesis = z.infer<typeof PersonaSynthesis>;

export const Angle = z.object({
  mode: z.enum(["news-insight", "experiment", "build-in-public"]),
  hook: z.string().min(1),
  source: z.string().optional(),
});
export const AngleList = z.object({ angles: z.array(Angle).min(1).max(5) });
export type Angle = z.infer<typeof Angle>;

export const OriginalDraft = z.object({
  posts: z.array(z.string().min(1).max(280)).min(1).max(7),
  suggestedVisual: z.string().max(500).optional(),
});
export type OriginalDraft = z.infer<typeof OriginalDraft>;
