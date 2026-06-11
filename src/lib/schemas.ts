import { z } from "zod";

export const DraftOutput = z.object({
  body: z.string().min(1).max(280),
  suggestedVisual: z.string().max(500).optional(),
});
export type DraftOutput = z.infer<typeof DraftOutput>;

export const TweetUrl = z
  .url()
  .refine((u) => /(?:twitter|x)\.com\/[^/]+\/status\/\d+/.test(u), "not a tweet URL");

// Per-post engagement metrics. Entered manually at first; the X API will
// populate the same shape later, so this is the single seam to swap.
export const PostMetrics = z.object({
  likes: z.coerce.number().int().min(0).default(0),
  reposts: z.coerce.number().int().min(0).default(0),
  replies: z.coerce.number().int().min(0).default(0),
  views: z.coerce.number().int().min(0).default(0),
});
export type PostMetrics = z.infer<typeof PostMetrics>;

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
export type WeeklyAngleList = z.infer<typeof WeeklyAngleList>;

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
export type ReplyCandidateList = z.infer<typeof ReplyCandidateList>;

export const ENGAGEMENT_SCENARIOS = ["supportive", "contrarian", "witty", "technical", "question"] as const;
export const ReplyDraft = z.object({
  reply: z.string().min(1).max(560).optional(),
  scenario: z.enum(ENGAGEMENT_SCENARIOS).optional(),
  skip: z.boolean().default(false),
});
export type ReplyDraft = z.infer<typeof ReplyDraft>;

export const ReplyOpportunity = ReplyCandidate.extend({
  reply: z.string().min(1).max(560),
});
export type ReplyOpportunity = z.infer<typeof ReplyOpportunity>;

export const ReplyQueue = z.object({
  generatedAt: z.string(),
  opportunities: z.array(ReplyOpportunity).min(0).max(5),
});
export type ReplyQueue = z.infer<typeof ReplyQueue>;

export const ThreadTweet = z.object({
  tweet: z.string().min(1).max(280),
  type: z.enum(["hook", "body", "cta"]).default("body"),
});
export const ThreadDraft = z.object({
  tweets: z.array(ThreadTweet).min(1).max(8),
  thin: z.boolean().default(false),
  thin_suggestion: z.string().nullable().optional(),
});
export type ThreadTweet = z.infer<typeof ThreadTweet>;
export type ThreadDraft = z.infer<typeof ThreadDraft>;

export const Trend = z.object({
  topic: z.string(),
  why_now: z.string(),
  angle: z.string(),
  source: z.string().optional(),
});
export const TrendReport = z.object({
  trends: z.array(Trend).min(1).max(5),
  generatedAt: z.string(),
});
export type Trend = z.infer<typeof Trend>;
export type TrendReport = z.infer<typeof TrendReport>;

// P2 topic board: every topic MUST carry dated sources — sourceless generation
// is rejected at the schema layer, which makes generateStructured retry.
export const TopicSource = z.object({
  url: z.string().url(),
  title: z.string().min(1),
  published_at: z.string().min(1),
});
export const TopicCandidate = z.object({
  topic: z.string().min(1),
  why_now: z.string().min(1),
  angle: z.string().min(1),
  kind: z.enum(["spike", "durable"]),
  sources: z.array(TopicSource).min(1),
});
export const TopicBoardReport = z.object({
  topics: z.array(TopicCandidate).min(1).max(6),
  generatedAt: z.string(),
});
export type TopicSource = z.infer<typeof TopicSource>;
export type TopicCandidate = z.infer<typeof TopicCandidate>;
export type TopicBoardReport = z.infer<typeof TopicBoardReport>;

// Credibility gate: does THIS account have standing to post about a trend?
// keep=false means drop it; angle is the specific take to draft if kept.
export const CredibilityVerdict = z.object({
  keep: z.boolean(),
  angle: z.string(),
  reason: z.string().min(1),
});
export type CredibilityVerdict = z.infer<typeof CredibilityVerdict>;

export const EngagementTarget = z.object({
  handle: z.string(),
  reason: z.string(),
  priority: z.enum(["high", "medium", "low"]),
  suggested_approach: z.string(),
});
export const TargetQueue = z.object({
  targets: z.array(EngagementTarget).min(0).max(10),
  generatedAt: z.string(),
});
export type EngagementTarget = z.infer<typeof EngagementTarget>;
export type TargetQueue = z.infer<typeof TargetQueue>;

export const BreakoutScore = z.object({
  score: z.number().min(1).max(7),
  verdict: z.string(),
  hook_strength: z.enum(["strong", "medium", "weak"]),
  fixes: z.array(z.string()).default([]),
});
export type BreakoutScore = z.infer<typeof BreakoutScore>;

export const GrowthPlanWatch = z.object({
  handle: z.string(),
  why: z.string(),
});

export const GrowthPlan = z.object({
  archetypeLabel: z.string().min(1),
  headline: z.string().min(1),
  voiceSummary: z.string().min(1),
  voiceTags: z.array(z.string()).max(8).default([]),
  pillars: z.array(z.string()).max(8).default([]),
  edge: z.string().min(1),
  whoToWatch: z.array(GrowthPlanWatch).max(10).default([]),
  rhythm: z.array(z.object({ count: z.string(), label: z.string() })).max(4).default([]),
  northStar: z.object({ metric: z.string(), detail: z.string() }),
  embalioDoes: z.array(z.string()).max(6).default([]),
  firstMoves: z.array(z.string()).max(5).default([]),
});
export type GrowthPlan = z.infer<typeof GrowthPlan>;
