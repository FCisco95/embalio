import { generateText as aiGenerateText } from "ai";
import { google } from "@ai-sdk/google";

// gemini-2.0-flash was shut down 2026-06-01; 2.5-flash is the GA free-tier model.
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

export async function generateTextGemini(prompt: string): Promise<string> {
  const { text } = await aiGenerateText({ model: google(GEMINI_MODEL), prompt });
  return text;
}
