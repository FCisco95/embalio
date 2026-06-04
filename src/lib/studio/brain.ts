import { generateStructured } from "@/lib/generate";
import { RankedTopicList, VideoScript, type AlgorithmBrief, type ChannelPlaybook, type RankedTopic, type TrendSignal } from "./schemas";

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
    `Each beat is one synchronized moment with these fields:`,
    `- id: a slug like "beat-1".`,
    `- say: the EXACT teleprompter line to read aloud.`,
    `- visualPrompt: the on-screen element/screen-capture for that line.`,
    `- do: a one-line imperative live action with a bracketed target, e.g. "Click [Cookbook] → Run scan" or "Stay on camera, hold frame". Use null if there is no screen action.`,
    `- fx: the edit cue to apply in post, e.g. "punch-zoom + freeze on \\"No GPU\\"" or "jump cut after this line". Use null if none.`,
    `- ost: a short on-screen caption (<= 10 words) for this beat. Use null if none.`,
    `- brollKeywords: up to 3 stock-footage search terms for screen beats, e.g. ["rtx 3080", "task manager gpu"]. Use null for face-only beats.`,
    `- markerLabel: a short label a creator would stamp at this beat (<= 80 chars), e.g. "B4 punch-zoom + ost: No GPU".`,
    `- estSeconds: rough duration in seconds.`,
    `Example beat: { "id": "beat-4", "say": "It looked at my machine and said: no GPU.", "visualPrompt": "Cookbook hardware scan result", "do": "Open [Cookbook] → run hardware scan → rest cursor on \\"No GPU\\"", "fx": "punch-zoom + freeze on \\"No GPU\\"", "ost": "Docker blind spot, not your PC", "brollKeywords": ["rtx 3080", "task manager gpu"], "markerLabel": "B4 punch-zoom + ost", "estSeconds": 12 }`,
    `Front-load the face + payoff; body is screen-only. Keep it tight.`,
    `Respond as JSON matching: { title, hook, beats: { id, say, visualPrompt, do, fx, ost, brollKeywords, markerLabel, estSeconds }[] }.`,
  ].filter(Boolean).join("\n\n");
}

export function buildBriefPrompt(niche: string): string {
  return [
    `You are a YouTube growth strategist. Research the CURRENT (2026) best practices for growing a channel in this niche: ${niche}.`,
    `Cover: packaging (titles/thumbnails/CTR), retention (first-15s hooks + pacing), which formats/series are winning, posting cadence, and how to avoid the "inauthentic/mass-produced content" demotion.`,
    `Ground every claim in real, current sources (creator channels, YouTube/Creator Insider, reputable analyses) and return their titles + urls.`,
    `Respond as JSON matching: { packaging: string[], retention: string[], formats: string[], cadence: string, authenticity: string[], summary: string, sources: { title, url }[] }.`,
  ].join("\n\n");
}

export function buildPlaybookPrompt(input: {
  niche: string;
  voiceSpec?: string;
  brief: AlgorithmBrief;
  northStarContext?: string;
}): string {
  const b = input.brief;
  return [
    `You are the channel strategist for a solo-dev YouTube channel.`,
    `Niche / brand: ${input.niche}.`,
    input.voiceSpec ? `Creator voice:\n${input.voiceSpec}` : "",
    input.northStarContext ? `Existing goals/context:\n${input.northStarContext}` : "",
    `Apply these current algorithm best practices:`,
    `- Packaging: ${b.packaging.join(" | ")}`,
    `- Retention: ${b.retention.join(" | ")}`,
    `- Winning formats: ${b.formats.join(" | ")}`,
    `- Cadence: ${b.cadence}`,
    `- Authenticity: ${b.authenticity.join(" | ")}`,
    `Synthesize a Channel Playbook: the channel's positioning/wedge; a DUAL north-star (one dev-brand metric e.g. subs, one Organic on-chain metric); 1-6 content pillars (name + why); packaging formulas to use; retention rules to apply to every script; a cadence; and concrete next moves (the path to follow now).`,
    `Respond as JSON matching: { positioning, northStar: { devBrand, organic }, pillars: { name, why }[], packagingFormulas: string[], retentionRules: string[], cadence, nextMoves: string[] }.`,
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
