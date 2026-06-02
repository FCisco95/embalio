import { generateStructured } from "@/lib/generate";
import { RankedTopicList, VideoScript, type ChannelPlaybook, type RankedTopic, type TrendSignal } from "./schemas";

export interface RankRequest {
  niche: string;
  voiceSpec?: string;
  signals: TrendSignal[];
  count?: number;
  playbook?: ChannelPlaybook;
}
export interface ScriptRequest {
  topic: RankedTopic;
  voiceSpec?: string;
  targetDurationSec?: number;
  playbook?: ChannelPlaybook;
}
export interface BrainClient {
  rankTopics(req: RankRequest): Promise<RankedTopic[]>;
  writeScript(req: ScriptRequest): Promise<VideoScript>;
}

function playbookBlock(pb?: ChannelPlaybook): string {
  if (!pb) return "";
  return [
    `Channel playbook — every choice must advance THIS strategy:`,
    `Positioning: ${pb.positioning}`,
    `Pillars: ${pb.pillars.map((p) => p.name).join(", ")}`,
    `Packaging formulas to use: ${pb.packagingFormulas.join(" | ")}`,
    `Retention rules: ${pb.retentionRules.join(" | ")}`,
    `Planned next moves: ${pb.nextMoves.join(" | ")}`,
  ].join("\n");
}

export function buildRankPrompt(req: RankRequest): string {
  const signalLines = req.signals
    .map((s) => `- [${s.source}] ${s.title} (${s.url})${s.score ? ` · ${s.score} pts` : ""}`)
    .join("\n");
  return [
    `You are the editorial brain for a solo-dev YouTube channel.`,
    `Niche: ${req.niche}.`,
    playbookBlock(req.playbook),
    req.playbook ? `Score each topic by how well it advances the playbook above (pillars, packaging, next moves), not generic virality.` : "",
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
    playbookBlock(req.playbook),
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
