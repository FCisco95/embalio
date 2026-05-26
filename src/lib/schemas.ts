import { z } from "zod";

export const DraftOutput = z.object({
  body: z.string().min(1).max(280),
  suggestedVisual: z.string().max(500).optional(),
});
export type DraftOutput = z.infer<typeof DraftOutput>;

export const TweetUrl = z
  .url()
  .refine((u) => /(?:twitter|x)\.com\/[^/]+\/status\/\d+/.test(u), "not a tweet URL");
