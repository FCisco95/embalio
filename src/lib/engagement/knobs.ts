export type EngagementGoal = "followers" | "reach" | "leads" | "authority" | "general";

export interface EngagementKnobs {
  goal: EngagementGoal;
  ownerFollowerEstimate: number;
  targetFollowerBand: { min: number; max: number };
  dailyReplyTarget: number;
  replyPlaybook: string;
}

export interface ProfileKnobInput {
  account_size: string | null;
  daily_capacity: string | null;
  north_star_metric: string | null;
  reply_playbook: string | null;
}

// Midpoint-ish owner follower estimate per account-size bucket.
const SIZE_ESTIMATE: Record<string, number> = {
  "<500": 250,
  "500-5k": 2750,
  "5k-50k": 27500,
  "50k+": 75000,
};

// Capacity bucket → target high-quality replies/day (research: 15-20 optimum, <50 cap).
const CAPACITY_TARGET: Record<string, number> = {
  "10m": 5,
  "30m": 12,
  "60m+": 20,
};

function normalizeGoal(metric: string | null): EngagementGoal {
  const m = (metric ?? "").toLowerCase();
  if (m.includes("lead") || m.includes("client") || m.includes("inbound")) return "leads";
  if (m.includes("reach") || m.includes("impression")) return "reach";
  if (m.includes("authority") || m.includes("niche")) return "authority";
  if (m.includes("follower")) return "followers";
  return "general";
}

export function knobsFromProfile(p: ProfileKnobInput): EngagementKnobs {
  const ownerFollowerEstimate = SIZE_ESTIMATE[p.account_size ?? ""] ?? 250;
  return {
    goal: normalizeGoal(p.north_star_metric),
    ownerFollowerEstimate,
    targetFollowerBand: { min: ownerFollowerEstimate * 2, max: ownerFollowerEstimate * 10 },
    dailyReplyTarget: CAPACITY_TARGET[p.daily_capacity ?? ""] ?? 10,
    replyPlaybook: p.reply_playbook ?? "",
  };
}
