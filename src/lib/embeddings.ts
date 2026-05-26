import { embed, embedMany } from "ai";
import { openai } from "@ai-sdk/openai";
import { MODELS } from "@/lib/models";

export function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2; }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function relevanceFromVectors(a: number[], b: number[]): number {
  return Math.max(0, Math.min(1, (cosine(a, b) + 1) / 2));
}

export async function embedText(text: string): Promise<number[]> {
  const { embedding } = await embed({ model: openai.embeddingModel(MODELS.embed), value: text });
  return embedding;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const { embeddings } = await embedMany({ model: openai.embeddingModel(MODELS.embed), values: texts });
  return embeddings;
}
