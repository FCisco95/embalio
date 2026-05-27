"use client";
import { useState } from "react";
import { synthesizePersona, savePersona, type InterviewAnswers } from "@/server/persona";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Synth = Awaited<ReturnType<typeof synthesizePersona>>;

export function OnboardingWizard({ profileId, defaults }: { profileId: string; defaults?: Partial<InterviewAnswers> }) {
  const [a, setA] = useState<InterviewAnswers>({
    niche: defaults?.niche ?? "AI, agentic & generative AI, new features, GitHub repos, building as a dev",
    goals: defaults?.goals ?? "", tone: defaults?.tone ?? "", doDont: "", admired: "",
  });
  const [synth, setSynth] = useState<Synth | null>(null);
  const [busy, setBusy] = useState(false);
  const upd = (k: keyof InterviewAnswers) => (e: { target: { value: string } }) => setA({ ...a, [k]: e.target.value });

  async function research() {
    setBusy(true);
    try { setSynth(await synthesizePersona(a)); toast.success("Voice spec drafted — review and edit"); }
    catch (e) { toast.error(String(e)); } finally { setBusy(false); }
  }
  async function save() {
    if (!synth) return;
    try {
      await savePersona(profileId, {
        voiceSpec: synth.voiceSpec, goals: a.goals, contentPillars: synth.contentPillars,
        answers: a, seedAccounts: synth.seedAccounts,
      });
      toast.success("Persona saved");
    } catch (e) { toast.error(String(e)); }
  }

  return (
    <div className="space-y-3 max-w-xl border rounded p-3 mt-3">
      <div className="font-medium text-sm">Brand-voice onboarding</div>
      <Textarea rows={2} placeholder="Niche & content pillars" value={a.niche} onChange={upd("niche")} />
      <Textarea rows={2} placeholder="Growth goal & target audience" value={a.goals} onChange={upd("goals")} />
      <Input placeholder="Tone/style (e.g. lowercase, punchy, technical)" value={a.tone} onChange={upd("tone")} />
      <Input placeholder="Do's / Don'ts (optional)" value={a.doDont ?? ""} onChange={upd("doDont")} />
      <Input placeholder="Accounts you admire (optional)" value={a.admired ?? ""} onChange={upd("admired")} />
      <Button disabled={busy} onClick={research}>{busy ? "Researching…" : "Draft my voice + plan"}</Button>
      {synth && (
        <div className="space-y-2 pt-2">
          <Textarea rows={6} value={synth.voiceSpec} onChange={(e) => setSynth({ ...synth, voiceSpec: e.target.value })} />
          <Input value={synth.contentPillars.join(", ")} onChange={(e) => setSynth({ ...synth, contentPillars: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
          <Input value={synth.seedAccounts.join(", ")} onChange={(e) => setSynth({ ...synth, seedAccounts: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
          {synth.samplePosts.length > 0 && <div className="text-xs text-muted-foreground">Samples: {synth.samplePosts.join(" · ")}</div>}
          <Button size="sm" variant="secondary" onClick={save}>Save persona</Button>
        </div>
      )}
    </div>
  );
}
