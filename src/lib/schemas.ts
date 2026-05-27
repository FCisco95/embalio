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
  samplePosts: z.array(z.string()).max(5).default([]),
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

export const WeeklyAngle = z.object({
  format: z.enum(["quick-take", "experiment", "tool-find", "observation", "reaction"]),
  hook: z.string().min(1),
  connection: z.string(),
  source: z.string().optional(),
  sourceDate: z.string().optional(),
});
export const WeeklyAngleList = z.object({ angles: z.array(WeeklyAngle).min(1).max(5) });
export type WeeklyAngle = z.infer<typeof WeeklyAngle>;

export const WeeklyPost = z.object({
  format: z.enum(["quick-take", "experiment", "tool-find", "observation", "reaction"]),
  hook: z.string(),
  posts: z.array(z.string().min(1).max(280)).min(1).max(7),
  context: z.string(),
  source: z.string().optional(),
  sourceDate: z.string().optional(),
  suggestedVisual: z.string().optional(),
});
export type WeeklyPost = z.infer<typeof WeeklyPost>;

export const WeeklyPostPlan = z.object({
  weekOf: z.string(),
  posts: z.array(WeeklyPost).min(1).max(5),
});
export type WeeklyPostPlan = z.infer<typeof WeeklyPostPlan>;

export const ReplyCandidate = z.object({
  targetHandle: z.string(),
  targetPost: z.string(),
  targetUrl: z.string().default(""),
  targetLikes: z.number().default(0),
  postedAt: z.string().default(""),
  reason: z.string(),
});
export const ReplyCandidateList = z.object({ opportunities: z.array(ReplyCandidate) });
export type ReplyCandidate = z.infer<typeof ReplyCandidate>;

export const ReplyDraft = z.object({
  reply: z.string().max(560).optional(),
  skip: z.boolean().default(false),
});
export type ReplyDraft = z.infer<typeof ReplyDraft>;

export const ReplyOpportunity = ReplyCandidate.extend({
  reply: z.string().max(560),
});
export type ReplyOpportunity = z.infer<typeof ReplyOpportunity>;

export const ReplyQueue = z.object({
  generatedAt: z.string(),
  opportunities: z.array(ReplyOpportunity).min(0).max(5),
});
export type ReplyQueue = z.infer<typeof ReplyQueue>;
