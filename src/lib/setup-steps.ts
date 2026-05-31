export type StepKind = "text" | "single" | "chips" | "toggle";
export type SetupFieldId =
  | "handle" | "accountSize" | "premium" | "pillars" | "goal" | "capacity" | "voiceMethod";

export interface StepOption {
  value: string;
  label: string;
}

export interface StepDef {
  id: SetupFieldId;
  question: string;
  explanation: string;
  kind: StepKind;
  options?: StepOption[];
  allowOpenText?: boolean;
  required?: boolean;
}

export interface SetupAnswers {
  handle: string;
  accountSize: string;
  premium: boolean;
  pillars: string[];
  goal: string;
  goalOpen?: string;
  capacity: string;
  voiceMethod: "pull" | "paste" | "tags";
  voiceCorpus: string[];
  voiceTags: string[];
}

export const EMPTY_ANSWERS: SetupAnswers = {
  handle: "", accountSize: "", premium: false, pillars: [],
  goal: "", goalOpen: "", capacity: "", voiceMethod: "pull", voiceCorpus: [], voiceTags: [],
};

export const STEPS: StepDef[] = [
  {
    id: "handle", kind: "text", required: true,
    question: "What's your X handle?",
    explanation: "So I can label your account and pull your recent posts to learn your voice.",
  },
  {
    id: "accountSize", kind: "single", required: true,
    question: "How big is the account today?",
    explanation: "This calibrates who I recommend you follow and what goals are realistic.",
    options: [
      { value: "<500", label: "Just starting (under 500)" },
      { value: "500-5k", label: "500 – 5k" },
      { value: "5k-50k", label: "5k – 50k" },
      { value: "50k+", label: "50k+" },
    ],
  },
  {
    id: "premium", kind: "toggle", required: true,
    question: "Are you on X Premium?",
    explanation: "Premium changes the algorithm rules I write to (post length, reach weighting).",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "pillars", kind: "chips", required: true, allowOpenText: true,
    question: "What do you post about?",
    explanation: "Your content pillars drive opportunity scoring and account recommendations.",
    options: [
      { value: "AI agents", label: "AI agents" },
      { value: "Building in public", label: "Building in public" },
      { value: "Dev tools", label: "Dev tools" },
      { value: "Startups", label: "Startups" },
    ],
  },
  {
    id: "goal", kind: "single", required: true, allowOpenText: true,
    question: "What's your main growth goal?",
    explanation: "I tailor recommendations and framing to what you actually want.",
    options: [
      { value: "followers", label: "More followers" },
      { value: "reach", label: "More reach / impressions" },
      { value: "leads", label: "Inbound leads / clients" },
      { value: "authority", label: "Authority in my niche" },
    ],
  },
  {
    id: "capacity", kind: "single", required: true,
    question: "How much time can you spend per day?",
    explanation: "This sets how many opportunities I surface and how often I draft.",
    options: [
      { value: "10m", label: "~10 minutes" },
      { value: "30m", label: "~30 minutes" },
      { value: "60m+", label: "1 hour or more" },
    ],
  },
  {
    id: "voiceMethod", kind: "single", required: true, allowOpenText: true,
    question: "How should I learn your voice?",
    explanation: "So drafts sound like the same person wrote them — not a bot.",
    options: [
      { value: "pull", label: "Pull my recent posts (recommended)" },
      { value: "paste", label: "I'll paste a few posts" },
      { value: "tags", label: "Just describe it with tags" },
    ],
  },
];
