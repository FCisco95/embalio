import { generateStructured } from "@/lib/generate";
import { CredibilityVerdict, type Trend } from "@/lib/schemas";
import { buildCredibilityPrompt } from "./prompt";

/** Gate one trend. Fails safe (keep=false) if the model can't produce a valid verdict. */
export async function gateTrend(pillars: string[], niche: string, trend: Trend): Promise<CredibilityVerdict> {
  const r = await generateStructured(CredibilityVerdict, buildCredibilityPrompt(pillars, niche, trend));
  if (!r.data) return { keep: false, angle: "", reason: "gate could not evaluate this trend" };
  return r.data;
}
