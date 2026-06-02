import { generateStructured } from "@/lib/generate";
import { RankedTopicList, VideoScript, type RankedTopic, type TrendSignal } from "./schemas";

export interface RankRequest {
  niche: string;
  voiceSpec?: string;
  signals: TrendSignal[];
  count?: number;
}
export interface ScriptRequest {
  topic: RankedTopic;
  voiceSpec?: string;
  targetDurationSec?: number;
}
export interface BrainClient {
  rankTopics(req: RankRequest): Promise<RankedTopic[]>;
  writeScript(req: ScriptRequest): Promise<VideoScript>;
}

export function buildRankPrompt(req: RankRequest): string {
  const signalLines = req.signals
    .map((s) => `- [${s.source}] ${s.title} (${s.url})${s.score ? ` · ${s.score} pts` : ""}`)
    .join("\n");
  return [
    `You are the editorial brain for a solo-dev YouTube channel.`,
    `Niche: ${req.niche}.`,
    req.voiceSpec ? `Creator voice:\n${req.voiceSpec}` : "",
    `Below are trending signals. Rank the best video topics for THIS niche (a vibe-coder who builds on blockchain and builds in public).`,
    `For each topic give: id (slug), title (packaging-rule, <=120 chars), angle (why this, for this niche), score 0-100 (brand fit), rationale, sourceRefs (the urls you used).`,
    `Return at most 6 topics, best first.`,
    `Signals:\n${signalLines}`,
    `Respond as JSON: { "topics": RankedTopic[] }.`,
  ].filter(Boolean).join("\n\n");
}

export function buildScriptPrompt(req: ScriptRequest): string {
  return [
    `You are scripting a real-face, screen-recorded solo-dev YouTube video.`,
    req.voiceSpec ? `Creator voice:\n${req.voiceSpec}` : "",
    `Topic: ${req.topic.title}`,
    `Angle: ${req.topic.angle}`,
    `Target length: ~${req.targetDurationSec ?? 360} seconds.`,
    `Write: a packaging-rule title; a hook that PAYS OFF in the first 15 seconds; then teleprompter "beats".`,
    `Each beat has: id, say (the exact teleprompter line to read), visualPrompt (the on-screen element/screen-capture for that line), estSeconds.`,
    `Front-load the face + payoff; body is screen-only. Keep it tight.`,
    `Respond as JSON matching: { title, hook, beats: { id, say, visualPrompt, estSeconds }[] }.`,
  ].filter(Boolean).join("\n\n");
}

type Gen = typeof generateStructured;

export function makeLocalClaudeBrain(gen: Gen = generateStructured): BrainClient {
  return {
    async rankTopics(req) {
      const r = await gen(RankedTopicList, buildRankPrompt(req));
      if (!r.data) throw new Error("topic ranking failed — try again");
      return req.count ? r.data.topics.slice(0, req.count) : r.data.topics;
    },
    async writeScript(req) {
      const r = await gen(VideoScript, buildScriptPrompt(req));
      if (!r.data) throw new Error("script generation failed — try again");
      return r.data;
    },
  };
}

/** Slice-1 brain. Swap this binding for an Agent-SDK-backed BrainClient later. */
export const brain: BrainClient = makeLocalClaudeBrain();
