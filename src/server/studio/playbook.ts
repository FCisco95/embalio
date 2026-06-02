"use server";
import { supabaseService, supabaseServer } from "@/lib/supabase/server";
import { generateStructured } from "@/lib/generate";
import { AlgorithmBrief, ChannelPlaybook } from "@/lib/studio/schemas";
import { buildBriefPrompt, buildPlaybookPrompt } from "@/lib/studio/brain";
import { buildVoiceSystemFromSpec } from "@/lib/voice-prompt";
import { runAlgorithmBrief } from "./algorithm-brief";
import type { Json } from "@/lib/supabase/types";

const DEFAULT_NICHE = "a vibe-coder who builds on blockchain and builds in public";

export async function getChannelPlaybook(profileId: string): Promise<ChannelPlaybook | null> {
  const sb = await supabaseServer();
  const { data } = await sb.from("profiles").select("channel_playbook").eq("id", profileId).single();
  const raw = data?.channel_playbook;
  if (!raw) return null;
  const parsed = ChannelPlaybook.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export async function generateChannelPlaybook(
  profileId: string,
  opts: { refreshResearch?: boolean } = {},
): Promise<ChannelPlaybook> {
  const sb = supabaseService();
  const { data: profile } = await sb.from("profiles").select("*").eq("id", profileId).single();
  const niche = profile?.niche_description?.trim() || DEFAULT_NICHE;
  const voiceSpec = profile ? buildVoiceSystemFromSpec(profile) : undefined;
  const northStarContext = (profile?.growth_plan as { northStar?: string } | null)?.northStar ?? undefined;

  const { brief, researched_at } = await runAlgorithmBrief(
    profileId,
    async () => {
      const r = await generateStructured(AlgorithmBrief, buildBriefPrompt(niche), { research: true, attempts: 3 });
      if (!r.data) throw new Error("algorithm research failed — try again");
      return r.data;
    },
    { freshnessDays: opts.refreshResearch ? 0 : 7 },
  );

  const r = await generateStructured(
    ChannelPlaybook,
    buildPlaybookPrompt({ niche, voiceSpec, brief, northStarContext }),
    { attempts: 4 },
  );
  if (!r.data) throw new Error("could not build the channel playbook — try again");
  const playbook: ChannelPlaybook = { ...r.data, briefResearchedAt: researched_at };

  const { error } = await sb
    .from("profiles")
    .update({ channel_playbook: playbook as unknown as Json })
    .eq("id", profileId);
  if (error) throw new Error(error.message);
  return playbook;
}
