"use client";
import { useMemo, useState } from "react";
import {
  EMPTY_ANSWERS, CHAPTERS, activeSteps,
  type SetupAnswers, type StepDef, type Archetype, type ChapterId,
} from "@/lib/setup-steps";
import { curatedSeedHandles, stepComplete, interstitialFor } from "@/lib/setup-logic";
import { buildSetupPreview, finalizeSetup, type SetupPreview } from "@/server/setup";
import { pullOwnVoiceCorpus } from "@/server/voice-pull";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Phase = "questions" | "interstitial" | "crafting" | "review" | "saving";

export function SetupQuiz({ profileId, onDone }: { profileId: string; onDone?: () => void }) {
  const [answers, setAnswers] = useState<SetupAnswers>(EMPTY_ANSWERS);
  const [stepIndex, setStepIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("questions");
  const [interChapter, setInterChapter] = useState<ChapterId | null>(null);
  const [preview, setPreview] = useState<SetupPreview | null>(null);
  const [voiceSpec, setVoiceSpec] = useState("");
  const [off, setOff] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState("");

  const steps = useMemo(() => activeSteps(answers.archetype), [answers.archetype]);
  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const total = steps.length;
  const set = (patch: Partial<SetupAnswers>) => setAnswers((a) => ({ ...a, ...patch }));

  const chapterIndex = CHAPTERS.findIndex((c) => c.id === step?.chapter);
  const progress = phase === "questions" ? (stepIndex + 1) / total : 1;

  function toggleInArray(field: keyof SetupAnswers, value: string) {
    setAnswers((a) => {
      const cur = (a[field] as string[]) ?? [];
      const nextArr = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
      return { ...a, [field]: nextArr };
    });
  }

  async function advance() {
    const isLast = stepIndex >= total - 1;
    // Show a reflective interstitial when leaving the last step of a chapter.
    const nextStep = steps[stepIndex + 1];
    const leavingChapter = isLast || nextStep?.chapter !== step.chapter;
    const inter = leavingChapter ? interstitialFor(step.chapter, answers) : null;
    if (inter && !isLast) {
      setInterChapter(step.chapter);
      setPhase("interstitial");
      return;
    }
    if (!isLast) { setStepIndex((i) => i + 1); return; }
    await craft();
  }

  function continueFromInterstitial() {
    setPhase("questions");
    setInterChapter(null);
    setStepIndex((i) => i + 1);
  }

  async function craft() {
    setPhase("crafting");
    try {
      if (answers.voiceMethod === "pull" && answers.handle.trim()) {
        try {
          const corpus = await pullOwnVoiceCorpus(answers.handle);
          set({ voiceCorpus: corpus });
        } catch {
          toast.message("Couldn't pull your posts — I'll work from your tags / pasted posts.");
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
      added: [...added.split(","), ...answers.inspirations].map((s) => s.trim()).filter(Boolean),
    });
    try {
      await finalizeSetup(profileId, { answers, voiceSpec, contentPillars: preview.synth.contentPillars, seedHandles });
      toast.success("Account is set up");
      onDone?.();
      window.location.href = "/";
    } catch (e) {
      toast.error(String(e));
      setPhase("review");
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-10">
      {/* Sectioned chapter progress */}
      <div className="mb-6 flex gap-1.5">
        {CHAPTERS.map((c, i) => (
          <div key={c.id} className="flex-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: phase !== "questions" || i < chapterIndex ? "100%" : i === chapterIndex ? `${progress * 100}%` : "0%" }}
              />
            </div>
            <div className={`mt-1 text-[10px] uppercase tracking-wide ${i === chapterIndex ? "text-brand-text" : "text-muted-foreground"}`}>{c.label}</div>
          </div>
        ))}
      </div>

      {phase === "questions" && step && (
        <div className="space-y-5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {CHAPTERS[chapterIndex]?.label} {step.optional && <span className="ml-1 normal-case text-[11px]">&middot; optional</span>}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{step.question}</h1>
          <p className="text-sm text-muted-foreground">{step.explanation}</p>

          <StepBody step={step} answers={answers} set={set} toggleInArray={toggleInArray} />

          <div className="flex justify-between pt-2">
            <Button variant="ghost" disabled={stepIndex === 0} onClick={() => setStepIndex((i) => i - 1)}>Back</Button>
            <div className="flex gap-2">
              {step.optional && (
                <Button variant="outline" onClick={advance}>Skip</Button>
              )}
              <Button disabled={!stepComplete(step, answers)} onClick={advance}>
                {stepIndex === total - 1 ? "Craft my plan" : "Next"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {phase === "interstitial" && interChapter && (() => {
        const i = interstitialFor(interChapter, answers);
        return (
          <div className="space-y-4 text-center">
            <div className="text-3xl">&#10024;</div>
            <h1 className="text-2xl font-bold tracking-tight">{i?.title}</h1>
            <p className="text-base text-muted-foreground">{i?.body}</p>
            <div className="pt-2"><Button onClick={continueFromInterstitial}>Keep going</Button></div>
          </div>
        );
      })()}

      {phase === "crafting" && <CraftingMoment />}

      {phase === "review" && preview && (
        <div className="space-y-5">
          <h1 className="text-2xl font-bold tracking-tight">Review your account</h1>
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Your voice</div>
            <Textarea rows={5} value={voiceSpec} onChange={(e) => setVoiceSpec(e.target.value)} />
          </div>
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Accounts I recommend watching &mdash; toggle off any that don&apos;t fit</div>
            {preview.targets.targets.length === 0 && (
              <p className="text-sm text-muted-foreground">No recommendations right now &mdash; add accounts below, or do it later from the board.</p>
            )}
            <div className="flex flex-col gap-2">
              {preview.targets.targets.map((t) => {
                const isOff = off.has(t.handle.toLowerCase());
                return (
                  <button
                    key={t.handle}
                    type="button"
                    onClick={() => setOff((prev) => { const n = new Set(prev); const k = t.handle.toLowerCase(); if (n.has(k)) n.delete(k); else n.add(k); return n; })}
                    className={`rounded-lg border px-3 py-2 text-left text-sm ${isOff ? "opacity-40" : "border-primary"}`}
                  >
                    <div className="font-semibold">{t.handle}</div>
                    <div className="text-xs text-muted-foreground">{t.reason}</div>
                  </button>
                );
              })}
            </div>
            <Input placeholder="Add accounts you already know, comma-separated" value={added} onChange={(e) => setAdded(e.target.value)} />
          </div>
          <Button onClick={finish}>Finish setup</Button>
        </div>
      )}

      {phase === "saving" && <div className="py-20 text-center text-muted-foreground">Saving&hellip;</div>}
    </div>
  );
}

function StepBody({ step, answers, set, toggleInArray }: {
  step: StepDef;
  answers: SetupAnswers;
  set: (p: Partial<SetupAnswers>) => void;
  toggleInArray: (field: keyof SetupAnswers, value: string) => void;
}) {
  const options = (step.optionsByArchetype && answers.archetype && step.optionsByArchetype[answers.archetype as Archetype]) || step.options || [];

  if (step.kind === "text") {
    return <Input autoFocus placeholder={step.id === "handle" ? "@yourhandle" : "Type your answer…"} value={(answers[step.id] as string) ?? ""} onChange={(e) => set({ [step.id]: e.target.value } as Partial<SetupAnswers>)} />;
  }

  if (step.kind === "longtext") {
    return <Textarea autoFocus rows={4} placeholder="A sentence or two…" value={(answers[step.id] as string) ?? ""} onChange={(e) => set({ [step.id]: e.target.value } as Partial<SetupAnswers>)} />;
  }

  if (step.kind === "taglist") {
    return <Input autoFocus placeholder="Comma-separated (e.g. @swyx, @hwchase17)" defaultValue={(answers[step.id] as string[] ?? []).join(", ")} onChange={(e) => set({ [step.id]: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } as Partial<SetupAnswers>)} />;
  }

  if (step.kind === "toggle") {
    const current = answers[step.id] as boolean;
    return (
      <div className="flex gap-2">
        {(step.options ?? []).map((o) => (
          <Button key={o.value} variant={(current ? "yes" : "no") === o.value ? "default" : "outline"} onClick={() => set({ [step.id]: o.value === "yes" } as Partial<SetupAnswers>)}>
            {o.label}
          </Button>
        ))}
      </div>
    );
  }

  if (step.kind === "single") {
    return (
      <div className="flex flex-col gap-2">
        {options.map((o) => {
          const selected = (answers as unknown as Record<string, unknown>)[step.id] === o.value;
          return (
            <Button key={o.value} variant={selected ? "default" : "outline"} className="justify-start" onClick={() => set({ [step.id]: o.value } as Partial<SetupAnswers>)}>
              {o.label}
            </Button>
          );
        })}
        {step.allowOpenText && step.id === "goal" && (
          <Input placeholder="Or describe your goal…" value={answers.goalOpen ?? ""} onChange={(e) => set({ goalOpen: e.target.value })} />
        )}
        {step.id === "voiceMethod" && answers.voiceMethod === "paste" && (
          <Textarea rows={5} placeholder="Paste a few of your best posts, one per line" onChange={(e) => set({ voiceCorpus: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })} />
        )}
        {step.id === "voiceMethod" && answers.voiceMethod === "tags" && (
          <Input placeholder="Tone tags, comma-separated (punchy, lowercase, technical)" onChange={(e) => set({ voiceTags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
        )}
      </div>
    );
  }

  // chips (multi-select into the step's own array field)
  const selectedArr = (answers[step.id] as string[]) ?? [];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = selectedArr.includes(o.value);
          return (
            <button key={o.value} type="button" onClick={() => toggleInArray(step.id, o.value)}
              className={`rounded-full border px-3 py-1.5 text-sm ${on ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
              {o.label}
            </button>
          );
        })}
      </div>
      {step.allowOpenText && (
        <Input placeholder="Add your own, comma-separated"
          onChange={(e) => set({ [step.id]: [...options.map((o) => o.value).filter((v) => selectedArr.includes(v)), ...e.target.value.split(",").map((s) => s.trim()).filter(Boolean)] } as Partial<SetupAnswers>)} />
      )}
    </div>
  );
}

function CraftingMoment() {
  const rows = [
    { label: "Reading your voice", w: "100%" },
    { label: "Finding accounts to engage", w: "60%" },
    { label: "Setting your weekly rhythm", w: "25%" },
  ];
  return (
    <div className="mx-auto max-w-md space-y-6 py-10 text-center">
      <div className="text-5xl">&#128296;</div>
      <h1 className="text-2xl font-bold tracking-tight">We&apos;re crafting <span className="text-brand-text">your growth plan&hellip;</span></h1>
      <div className="space-y-4">
        {rows.map((r) => (
          <div key={r.label} className="space-y-1 text-left">
            <div className="text-sm font-semibold">{r.label}</div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all duration-1000" style={{ width: r.w }} />
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">the engine is actually running behind this screen</p>
    </div>
  );
}
