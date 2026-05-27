import { generateText as aiGenerateText } from "ai";
import { google } from "@ai-sdk/google";

export async function generateTextGemini(prompt: string): Promise<string> {
  const { text } = await aiGenerateText({ model: google("gemini-2.0-flash"), prompt });
  return text;
}
