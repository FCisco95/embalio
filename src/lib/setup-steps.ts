export type Archetype = "dev" | "founder" | "creator" | "trader" | "protocol";
export type ChapterId = "you" | "goal" | "niche" | "channels" | "voice" | "inspirations" | "rhythm";
export type StepKind = "text" | "longtext" | "single" | "chips" | "toggle" | "taglist";

export type SetupFieldId =
  | "archetype" | "zoneOfGenius" | "motive" | "archetypeDetail" | "handle"
  | "goal" | "goalTarget" | "accountSize" | "intensity"
  | "pillars" | "angle" | "audience"
  | "platforms" | "premium" | "formats" | "showFace" | "creativeTools" | "advantages"
  | "voiceMethod" | "replyPlaybook"
  | "inspirations" | "engageNow"
  | "capacity" | "consistency" | "commitment";

export interface StepOption { value: string; label: string }

export interface StepDef {
  id: SetupFieldId;
  chapter: ChapterId;
  question: string;
  explanation: string;
  kind: StepKind;
  options?: StepOption[];
  optionsByArchetype?: Partial<Record<Archetype, StepOption[]>>;
  allowOpenText?: boolean;
  required?: boolean;   // Core
  optional?: boolean;   // skippable
  showFor?: Archetype[]; // structural branching; omit = all archetypes
}

export interface SetupAnswers {
  // you
  archetype: Archetype | "";
  zoneOfGenius: string;
  motive: string;
  archetypeDetail: string;
  handle: string;
  // goal
  goal: string;
  goalOpen?: string;
  goalTarget: string;
  accountSize: string;
  intensity: string;
  // niche
  pillars: string[];
  angle: string;
  audience: string;
  // channels
  platforms: string[];
  premium: boolean;
  formats: string[];
  showFace: boolean;
  creativeTools: string[];
  advantages: string;
  // voice
  voiceMethod: "pull" | "paste" | "tags";
  voiceCorpus: string[];
  voiceTags: string[];
  replyPlaybook: string;
  // inspirations
  inspirations: string[];
  engageNow: string[];
  // rhythm
  capacity: string;
  consistency: string;
  commitment: string;
}

export const EMPTY_ANSWERS: SetupAnswers = {
  archetype: "", zoneOfGenius: "", motive: "", archetypeDetail: "", handle: "",
  goal: "", goalOpen: "", goalTarget: "", accountSize: "", intensity: "",
  pillars: [], angle: "", audience: "",
  platforms: [], premium: false, formats: [], showFace: false, creativeTools: [], advantages: "",
  voiceMethod: "pull", voiceCorpus: [], voiceTags: [], replyPlaybook: "",
  inspirations: [], engageNow: [],
  capacity: "", consistency: "", commitment: "",
};

export const CHAPTERS: { id: ChapterId; label: string }[] = [
  { id: "you", label: "You" },
  { id: "goal", label: "Goal" },
  { id: "niche", label: "Niche & edge" },
  { id: "channels", label: "Channels" },
  { id: "voice", label: "Voice" },
  { id: "inspirations", label: "Inspirations" },
  { id: "rhythm", label: "Rhythm" },
];

const ARCHETYPE_OPTIONS: StepOption[] = [
  { value: "dev", label: "Developer / Builder" },
  { value: "founder", label: "Founder / Operator" },
  { value: "creator", label: "Creator / Educator" },
  { value: "trader", label: "Trader / Investor" },
  { value: "protocol", label: "Project / Protocol" },
];

const PILLARS_BY_ARCHETYPE: Partial<Record<Archetype, StepOption[]>> = {
  dev: [
    { value: "AI agents", label: "AI agents" },
    { value: "Dev tools", label: "Dev tools" },
    { value: "Building in public", label: "Building in public" },
    { value: "Infra", label: "Infra / systems" },
  ],
  founder: [
    { value: "Startups", label: "Startups" },
    { value: "Building in public", label: "Building in public" },
    { value: "Go-to-market", label: "Go-to-market" },
    { value: "Fundraising", label: "Fundraising" },
  ],
  creator: [
    { value: "Education", label: "Education" },
    { value: "Tutorials", label: "Tutorials" },
    { value: "Creator economy", label: "Creator economy" },
    { value: "Productivity", label: "Productivity" },
  ],
  trader: [
    { value: "Markets", label: "Markets" },
    { value: "Trading", label: "Trading" },
    { value: "Macro", label: "Macro" },
    { value: "DeFi", label: "DeFi" },
  ],
  protocol: [
    { value: "Protocol", label: "Protocol / product" },
    { value: "Ecosystem", label: "Ecosystem" },
    { value: "Governance", label: "Governance" },
    { value: "Onchain", label: "Onchain" },
  ],
};

export const STEPS: StepDef[] = [
  // ── Chapter: You ──
  {
    id: "archetype", chapter: "you", kind: "single", required: true,
    question: "Which of these is closest to you?",
    explanation: "This is the keystone — there's no universal growth formula, so I tailor everything to your type.",
    options: ARCHETYPE_OPTIONS,
  },
  {
    id: "zoneOfGenius", chapter: "you", kind: "longtext", optional: true,
    question: "Where are you 10× better than most?",
    explanation: "Your zone of genius — what I lean on when drafting in your voice. Skip if unsure.",
  },
  {
    id: "archetypeDetail", chapter: "you", kind: "text", optional: true, showFor: ["dev"],
    question: "What are you building right now?",
    explanation: "Grounds your replies in real, current work.",
  },
  {
    id: "archetypeDetail", chapter: "you", kind: "text", optional: true, showFor: ["founder"],
    question: "What does your company do?",
    explanation: "Grounds your replies in what you actually ship.",
  },
  {
    id: "archetypeDetail", chapter: "you", kind: "text", optional: true, showFor: ["creator"],
    question: "What format is your bread and butter?",
    explanation: "So I draft to the shape your audience already expects from you.",
  },
  {
    id: "archetypeDetail", chapter: "you", kind: "text", optional: true, showFor: ["trader"],
    question: "What's your edge or track record?",
    explanation: "What makes your take worth reading in a noisy market.",
  },
  {
    id: "archetypeDetail", chapter: "you", kind: "text", optional: true, showFor: ["protocol"],
    question: "What stage is the project / protocol?",
    explanation: "Pre-launch vs live changes who you should be engaging.",
  },
  {
    id: "motive", chapter: "you", kind: "longtext", optional: true,
    question: "Why are you really doing this?",
    explanation: "The honest reason. It keeps the plan pointed at what you actually want.",
  },
  {
    id: "handle", chapter: "you", kind: "text", required: true,
    question: "What's your X handle?",
    explanation: "So I can label your account and pull your recent posts to learn your voice.",
  },

  // ── Chapter: Goal ──
  {
    id: "goal", chapter: "goal", kind: "single", required: true, allowOpenText: true,
    question: "What's your main growth goal?",
    explanation: "I tailor scoring, reply objective, and framing to what you actually want.",
    options: [
      { value: "followers", label: "More followers" },
      { value: "reach", label: "More reach / impressions" },
      { value: "leads", label: "Inbound leads / clients" },
      { value: "authority", label: "Authority in my niche" },
    ],
  },
  {
    id: "goalTarget", chapter: "goal", kind: "text", required: true,
    question: "Your 90-day target — put a number on it.",
    explanation: 'e.g. "2,000 engaged followers". This becomes your north-star on the plan.',
  },
  {
    id: "accountSize", chapter: "goal", kind: "single", required: true,
    question: "How big is the account today?",
    explanation: "This calibrates the 5–20× band of accounts worth engaging and what goals are realistic.",
    options: [
      { value: "<500", label: "Just starting (under 500)" },
      { value: "500-5k", label: "500 – 5k" },
      { value: "5k-50k", label: "5k – 50k" },
      { value: "50k+", label: "50k+" },
    ],
  },
  {
    id: "intensity", chapter: "goal", kind: "single", optional: true,
    question: "How hard do you want to push?",
    explanation: "Sets how aggressive the cadence and targets are.",
    options: [
      { value: "steady", label: "Steady & sustainable" },
      { value: "ambitious", label: "Ambitious" },
      { value: "allin", label: "All-in sprint" },
    ],
  },

  // ── Chapter: Niche & edge ──
  {
    id: "pillars", chapter: "niche", kind: "chips", required: true, allowOpenText: true,
    question: "What do you post about?",
    explanation: "Your content pillars drive relevance scoring and account recommendations.",
    options: PILLARS_BY_ARCHETYPE.dev,
    optionsByArchetype: PILLARS_BY_ARCHETYPE,
  },
  {
    id: "angle", chapter: "niche", kind: "longtext", required: true,
    question: "Why should someone follow YOU and not the other accounts in your niche?",
    explanation: "Your edge. This is the sharpest input I have — it shapes every draft.",
  },
  {
    id: "audience", chapter: "niche", kind: "text", optional: true,
    question: "Who are you trying to reach?",
    explanation: "The people you want following you. Helps me pick the right accounts.",
  },

  // ── Chapter: Channels & superpowers ──
  {
    id: "platforms", chapter: "channels", kind: "chips", required: true,
    question: "Which platforms are you growing?",
    explanation: "X is active now; the others I capture for later.",
    options: [
      { value: "x", label: "X / Twitter" },
      { value: "linkedin", label: "LinkedIn" },
      { value: "youtube", label: "YouTube" },
    ],
  },
  {
    id: "premium", chapter: "channels", kind: "toggle", required: true,
    question: "Are you on X Premium?",
    explanation: "Premium changes the algorithm rules I write to (post length, reach weighting).",
    options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }],
  },
  {
    id: "formats", chapter: "channels", kind: "chips", required: true,
    question: "What formats will you actually make?",
    explanation: "I only suggest post types you're willing to create.",
    options: [
      { value: "text", label: "Text posts" },
      { value: "threads", label: "Threads" },
      { value: "images", label: "Images / screenshots" },
      { value: "video", label: "Video" },
    ],
  },
  {
    id: "showFace", chapter: "channels", kind: "toggle", optional: true,
    question: "Willing to show your face?",
    explanation: "Affects which formats I lean on.",
    options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }],
  },
  {
    id: "creativeTools", chapter: "channels", kind: "taglist", optional: true,
    question: "Can you make visuals / use AI tools?",
    explanation: "List what you've got (Figma, Midjourney, none…). Comma-separated.",
  },
  {
    id: "advantages", chapter: "channels", kind: "longtext", optional: true,
    question: "Any unfair advantages?",
    explanation: "Audiences elsewhere, a network, a credential, a story — anything.",
  },

  // ── Chapter: Voice ──
  {
    id: "voiceMethod", chapter: "voice", kind: "single", required: true, allowOpenText: true,
    question: "How should your voice sound — and how do I learn it?",
    explanation: "So drafts sound like the same person wrote them — not a bot.",
    options: [
      { value: "pull", label: "Pull my recent posts (recommended)" },
      { value: "paste", label: "I'll paste a few posts" },
      { value: "tags", label: "Just describe it with tags" },
    ],
  },
  {
    id: "replyPlaybook", chapter: "voice", kind: "longtext", optional: true,
    question: "Anything you'll NEVER do?",
    explanation: "Hard guardrails — topics, tones, words to avoid. I obey these strictly.",
  },

  // ── Chapter: Inspirations & rivals ──
  {
    id: "inspirations", chapter: "inspirations", kind: "taglist", required: true,
    question: "Which accounts do you want to grow like?",
    explanation: "Comma-separated handles. These seed who I watch and how I model your voice.",
  },
  {
    id: "engageNow", chapter: "inspirations", kind: "taglist", optional: true,
    question: "Anyone you want to start engaging right now?",
    explanation: "Comma-separated handles I'll prioritize from day one.",
  },

  // ── Chapter: Rhythm & commitment ──
  {
    id: "capacity", chapter: "rhythm", kind: "single", required: true,
    question: "How much time can you spend per day?",
    explanation: "This sets how many opportunities I surface and how often I draft.",
    options: [
      { value: "10m", label: "~10 minutes" },
      { value: "30m", label: "~30 minutes" },
      { value: "60m+", label: "1 hour or more" },
    ],
  },
  {
    id: "consistency", chapter: "rhythm", kind: "single", optional: true,
    question: "How consistent have you been so far?",
    explanation: "No judgment — it just calibrates the plan.",
    options: [
      { value: "rarely", label: "Rarely post" },
      { value: "sometimes", label: "On and off" },
      { value: "daily", label: "Most days" },
    ],
  },
  {
    id: "commitment", chapter: "rhythm", kind: "single", optional: true,
    question: "Will you show up on slow days?",
    explanation: "Growth compounds from showing up. Be honest.",
    options: [
      { value: "in", label: "I'm in" },
      { value: "remind", label: "Be honest — remind me" },
    ],
  },
];

/** Structural branching: drop archetype-specific steps that don't match. */
export function activeSteps(archetype: Archetype | ""): StepDef[] {
  return STEPS.filter((s) => !s.showFor || (archetype !== "" && s.showFor.includes(archetype)));
}
