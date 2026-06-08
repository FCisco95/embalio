import type { Trend } from "@/lib/schemas";

/**
 * The gate: keep a trend only if this account can add a real take (hands-on,
 * data, or a genuine opinion) within its niche/pillars. Off-niche noise is
 * dropped — chasing every trend builds no audience and burns reach.
 */
export function buildCredibilityPrompt(pillars: string[], niche: string, trend: Trend): string {
  return [
    `You are the credibility gate for an X (Twitter) account.`,
    `Account niche: ${niche || "(unspecified)"}`,
    `Content pillars: ${pillars.length ? pillars.join("; ") : "(none set)"}`,
    ``,
    `A trending topic surfaced:`,
    `- topic: ${trend.topic}`,
    `- why now: ${trend.why_now}`,
    `- raw angle: ${trend.angle}`,
    trend.source ? `- source: ${trend.source}` : ``,
    ``,
    `Decide: can THIS account credibly post about this — adding hands-on experience,`,
    `data, or a real opinion that fits its niche/pillars — or is it off-niche noise?`,
    `Be strict. Default to keep=false when the fit is weak; a tight account beats a loud one.`,
    ``,
    `Return:`,
    `- keep: boolean (true only if there is a credible, on-niche angle)`,
    `- angle: a single concrete post angle in this account's lane (empty string if keep=false)`,
    `- reason: one sentence on why kept or dropped`,
  ].filter(Boolean).join("\n");
}
