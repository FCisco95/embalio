"use client";
import { useState } from "react";
import { STEPS, EMPTY_ANSWERS, type SetupAnswers, type StepDef } from "@/lib/setup-steps";
import { curatedSeedHandles } from "@/lib/setup-logic";
import { buildSetupPreview, finalizeSetup, type SetupPreview } from "@/server/setup";
import { pullOwnVoiceCorpus } from "@/server/voice-pull";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Phase = "questions" | "building" | "review" | "saving";

export function SetupQuiz({ profileId, onDone }: { profileId: string; onDone?: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<SetupAnswers>(EMPTY_ANSWERS);
  const [phase, setPhase] = useState<Phase>("questions");
  const [preview, setPreview] = useState<SetupPreview | null>(null);
  const [voiceSpec, setVoiceSpec] = useState("");
  const [off, setOff] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState("");

  const step = STEPS[stepIndex];
  const total = STEPS.length;
  const set = (patch: Partial<SetupAnswers>) => setAnswers((a) => ({ ...a, ...patch }));

  function stepComplete(s: StepDef): boolean {
    if (!s.required) return true;
    if (s.id === "pillars") return answers.pillars.length > 0;
    if (s.id === "premium") return typeof answers.premium === "boolean";
    const v = (answers as unknown as Record<string, unknown>)[s.id];
    return typeof v === "string" ? v.trim().length > 0 : Boolean(v);
  }

  async function next() {
    if (stepIndex < total - 1) {
      setStepIndex((i) => i + 1);
      return;
    }
    setPhase("building");
    try {
      if (answers.voiceMethod === "pull" && answers.handle.trim()) {
        try {
          const corpus = await pullOwnVoiceCorpus(answers.handle);
          set({ voiceCorpus: corpus });
        } catch {
          toast.message("Couldn't pull your posts — describe your voice with tags instead.");
        }
      }
      const p = await buildSetupPreview(answers);
      setPreview(p);
      setVoiceSpec(p.synth.voiceSpec);
      setPhase("review");
    } catch (e) {
      toast.error(String(e));
      setPhase("questions");
    }
  }

  async function finish() {
    if (!preview) return;
    setPhase("saving");
    const recommended = preview.targets.targets.map((t) => t.handle);
    const seedHandles = curatedSeedHandles({
      recommended,
      toggledOff: [...off],
      added: added.split(",").map((s) => s.trim()).filter(Boolean),
    });
    try {
      await finalizeSetup(profileId, {
        answers,
        voiceSpec,
        contentPillars: preview.synth.contentPillars,
        seedHandles,
      });
      toast.success("Account is set up");
      onDone?.();
      window.location.href = "/";
    } catch (e) {
      toast.error(String(e));
      setPhase("review");
    }
  }

  const progress = phase === "questions" ? (stepIndex + 1) / total : 1;

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-10">
      <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary transition-all" style={{ width: `${progress * 100}%` }} />
      </div>

      {phase === "questions" && (
        <div className="space-y-5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Step {stepIndex + 1} of {total}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{step.question}</h1>
          <p className="text-sm text-muted-foreground">{step.explanation}</p>

          {step.kind === "text" && (
            <Input
              autoFocus
              placeholder="@yourhandle"
              value={answers.handle}
              onChange={(e) => set({ handle: e.target.value })}
            />
          )}

          {step.kind === "toggle" && (
            <div className="flex gap-2">
              {step.options!.map((o) => (
                <Button
                  key={o.value}
                  variant={(answers.premium ? "yes" : "no") === o.value ? "default" : "outline"}
                  onClick={() => set({ premium: o.value === "yes" })}
                >
                  {o.label}
                </Button>
              ))}
            </div>
          )}

          {step.kind === "single" && (
            <div className="flex flex-col gap-2">
              {step.options!.map((o) => {
                const selected = (answers as unknown as Record<string, unknown>)[step.id] === o.value;
                return (
                  <Button
                    key={o.value}
                    variant={selected ? "default" : "outline"}
                    className="justify-start"
                    onClick={() => set({ [step.id]: o.value } as Partial<SetupAnswers>)}
                  >
                    {o.label}
                  </Button>
                );
              })}
              {step.allowOpenText && step.id === "goal" && (
                <Input
                  placeholder="Or describe your goal…"
                  value={answers.goalOpen ?? ""}
                  onChange={(e) => set({ goalOpen: e.target.value })}
                />
              )}
              {step.id === "voiceMethod" && answers.voiceMethod === "paste" && (
                <Textarea
                  rows={5}
                  placeholder="Paste a few of your best posts, one per line"
                  onChange={(e) => set({ voiceCorpus: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
                />
              )}
              {step.id === "voiceMethod" && answers.voiceMethod === "tags" && (
                <Input
                  placeholder="Tone tags, comma-separated (punchy, lowercase, technical)"
                  onChange={(e) => set({ voiceTags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                />
              )}
            </div>
          )}

          {step.kind === "chips" && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {step.options!.map((o) => {
                  const on = answers.pillars.includes(o.value);
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() =>
                        set({
                          pillars: on
                            ? answers.pillars.filter((p) => p !== o.value)
                            : [...answers.pillars, o.value],
                        })
                      }
                      className={`rounded-full border px-3 py-1.5 text-sm ${on ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
              {step.allowOpenText && (
                <Input
                  placeholder="Add your own, comma-separated"
                  onChange={(e) =>
                    set({
                      pillars: [
                        ...step.options!.map((o) => o.value).filter((v) => answers.pillars.includes(v)),
                        ...e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                      ],
                    })
                  }
                />
              )}
            </div>
          )}

          <div className="flex justify-between pt-2">
            <Button variant="ghost" disabled={stepIndex === 0} onClick={() => setStepIndex((i) => i - 1)}>
              Back
            </Button>
            <Button disabled={!stepComplete(step)} onClick={next}>
              {stepIndex === total - 1 ? "Build my account" : "Next"}
            </Button>
          </div>
        </div>
      )}

      {phase === "building" && (
        <div className="py-20 text-center text-muted-foreground">
          Analyzing your voice and finding accounts to follow…
        </div>
      )}

      {phase === "review" && preview && (
        <div className="space-y-5">
          <h1 className="text-2xl font-bold tracking-tight">Review your account</h1>
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Your voice</div>
            <Textarea rows={5} value={voiceSpec} onChange={(e) => setVoiceSpec(e.target.value)} />
          </div>
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Accounts I recommend watching — toggle off any that don&apos;t fit
            </div>
            {preview.targets.targets.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No recommendations right now — add accounts below, or do it later from the board.
              </p>
            )}
            <div className="flex flex-col gap-2">
              {preview.targets.targets.map((t) => {
                const isOff = off.has(t.handle.toLowerCase());
                return (
                  <button
                    key={t.handle}
                    type="button"
                    onClick={() =>
                      setOff((prev) => {
                        const n = new Set(prev);
                        const k = t.handle.toLowerCase();
                        if (n.has(k)) n.delete(k);
                        else n.add(k);
                        return n;
                      })
                    }
                    className={`rounded-lg border px-3 py-2 text-left text-sm ${isOff ? "opacity-40" : "border-primary"}`}
                  >
                    <div className="font-semibold">{t.handle}</div>
                    <div className="text-xs text-muted-foreground">{t.reason}</div>
                  </button>
                );
              })}
            </div>
            <Input
              placeholder="Add accounts you already know, comma-separated"
              value={added}
              onChange={(e) => setAdded(e.target.value)}
            />
          </div>
          <Button onClick={finish}>Finish setup</Button>
        </div>
      )}

      {phase === "saving" && <div className="py-20 text-center text-muted-foreground">Saving…</div>}
    </div>
  );
}
