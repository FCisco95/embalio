import { embed, embedMany } from "ai";
import { openai } from "@ai-sdk/openai";
import { MODELS } from "@/lib/models";

export function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2; }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function isDegenerate(v: number[]): boolean {
  if (!v || v.length === 0) return true;
  for (let i = 0; i < v.length; i++) if (v[i] !== 0) return false;
  return true;
}

export function relevanceFromVectors(a: number[], b: number[]): number {
  // A failed/empty embedding (API hiccup, quota, empty voice corpus) comes back as
  // a zero vector. cosine() returns 0 for it, which would map to 0.5 ("half
  // relevant") and let a fresh in-band post clear the sniper score threshold on
  // recency+size alone. Treat a degenerate vector as 0 relevance instead. A
  // genuinely orthogonal pair of REAL vectors still maps to 0.5.
  if (isDegenerate(a) || isDegenerate(b)) return 0;
  return Math.max(0, Math.min(1, (cosine(a, b) + 1) / 2));
}

export async function embedText(text: string): Promise<number[]> {
  const { embedding } = await embed({ model: openai.embeddingModel(MODELS.embed), value: text });
  return embedding;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  // OpenAI's embeddings API rejects empty strings inside a batch; substitute a
  // single space so one text-less item can't fail the whole batch. Index
  // alignment is preserved. (Callers like the scan also skip empty tweets.)
  const safe = texts.map((t) => (t && t.trim().length > 0 ? t : " "));
  const { embeddings } = await embedMany({ model: openai.embeddingModel(MODELS.embed), values: safe });
  return embeddings;
}
