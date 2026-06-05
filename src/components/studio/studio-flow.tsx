"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StyledSelect } from "@/components/ui/select-native";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { createVideoProject, goBackToStage } from "@/server/studio/projects";
import { STUDIO_STAGES, type StudioStage } from "@/lib/studio/schemas";
import { isEarlierStage } from "@/lib/studio/stages";
import { TopicBoard } from "./topic-board";
import { ScriptStudio } from "./script-studio";
import { RecordHub } from "./record-hub";
import { PublishPanel } from "./publish-panel";
import { RepurposePanel } from "./repurpose-panel";
import { PlaybookPanel, type BriefMeta } from "./playbook-panel";
import type { ChannelPlaybook } from "@/lib/studio/schemas";

type Project = { id: string; stage: string; topic: unknown; script: unknown; recording: unknown; publish: unknown };

const STAGE_LABEL: Record<StudioStage, string> = {
  topic: "Topic", script: "Script", record: "Record", publish: "Publish", repurposed: "Repurpose",
};

/** Human label for the project switcher: script title → topic title → fallback. */
function projectLabel(p: Project): string {
  const title =
    (p.script as { title?: string } | null)?.title ??
    (p.topic as { title?: string } | null)?.title ??
    "Untitled video";
  const stage = STAGE_LABEL[p.stage as StudioStage] ?? p.stage;
  const short = title.length > 48 ? `${title.slice(0, 48)}…` : title;
  return `${short} · ${stage}`;
}

export function StudioFlow({
  profileId, recordingProfiles, initialProjects, ytConnected, playbook, briefMeta,
}: {
  profileId: string;
  recordingProfiles: { id: string; device_label: string; os: string; capture_tool: string; teleprompter_placement: string; scene_presets: unknown; export_path: string | null }[];
  initialProjects: Project[];
  ytConnected: boolean;
  playbook: ChannelPlaybook | null;
  briefMeta: BriefMeta | null;
}) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [activeId, setActiveId] = useState<string | null>(initialProjects[0]?.id ?? null);
  const active = projects.find((p) => p.id === activeId) ?? null;

  async function newProject() {
    try {
      const p = (await createVideoProject(profileId)) as Project;
      setProjects((prev) => [p, ...prev]);
      setActiveId(p.id);
    } catch (e) { toast.error(String(e)); }
  }

  function patchActive(patch: Partial<Project>) {
    setProjects((prev) => prev.map((p) => (p.id === activeId ? { ...p, ...patch } : p)));
  }

  if (!active) {
    return (
      <div className="space-y-5">
        <PlaybookPanel profileId={profileId} initialPlaybook={playbook} briefMeta={briefMeta} />
        <div className="rounded-xl border border-border p-10 text-center">
          <p className="mb-4 text-sm text-muted-foreground">No video in progress.</p>
          <Button onClick={newProject} disabled={!profileId}>Start a new video</Button>
        </div>
      </div>
    );
  }

  const stage = active.stage as StudioStage;

  return (
    <div className="space-y-5">
      <PlaybookPanel profileId={profileId} initialPlaybook={playbook} briefMeta={briefMeta} />
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {STUDIO_STAGES.map((s) => {
            const canGoBack = isEarlierStage(stage, s);
            return (
              <button
                key={s}
                type="button"
                disabled={!canGoBack}
                title={canGoBack ? `Go back to ${STAGE_LABEL[s]}` : undefined}
                onClick={async () => {
                  try {
                    await goBackToStage(active.id, s);
                    patchActive({ stage: s });
                  } catch (e) { toast.error(String(e)); }
                }}
                className={cn(
                  "rounded-full px-3 py-1 text-[12px] font-medium",
                  s === stage ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
                  canGoBack ? "cursor-pointer hover:bg-secondary/70 hover:text-foreground" : "cursor-default",
                )}
              >{STAGE_LABEL[s]}</button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          {projects.length > 1 && (
            <StyledSelect
              value={activeId ?? ""}
              onChange={(e) => setActiveId(e.target.value)}
              aria-label="Switch video project"
              className="max-w-[280px] py-1.5 text-[12.5px]"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{projectLabel(p)}</option>
              ))}
            </StyledSelect>
          )}
          <Button variant="outline" size="sm" onClick={newProject}>New video</Button>
        </div>
      </div>

      {stage === "topic" && <TopicBoard profileId={profileId} projectId={active.id} onChosen={() => patchActive({ stage: "script" })} />}
      {stage === "script" && <ScriptStudio projectId={active.id} script={active.script} onAdvance={() => patchActive({ stage: "record" })} onScript={(script) => patchActive({ script })} />}
      {stage === "record" && <RecordHub projectId={active.id} script={active.script} recordingProfiles={recordingProfiles} onConfirmed={() => patchActive({ stage: "publish" })} />}
      {stage === "publish" && <PublishPanel projectId={active.id} ytConnected={ytConnected} onPublished={(publish) => patchActive({ publish, stage: "repurposed" })} />}
      {stage === "repurposed" && <RepurposePanel projectId={active.id} publish={active.publish} />}
    </div>
  );
}
