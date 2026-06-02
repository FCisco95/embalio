"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { createVideoProject } from "@/server/studio/projects";
import { STUDIO_STAGES, type StudioStage } from "@/lib/studio/schemas";
import { TopicBoard } from "./topic-board";
import { ScriptStudio } from "./script-studio";
import { RecordHub } from "./record-hub";
import { PublishPanel } from "./publish-panel";
import { RepurposePanel } from "./repurpose-panel";
import { RenderPanel } from "./render-panel";

type Project = { id: string; stage: string; topic: unknown; script: unknown; recording: unknown; publish: unknown };

const STAGE_LABEL: Record<StudioStage, string> = {
  topic: "Topic", script: "Script", record: "Record", publish: "Publish", repurposed: "Repurpose",
};

export function StudioFlow({
  profileId, recordingProfiles, initialProjects, ytConnected,
}: {
  profileId: string;
  recordingProfiles: { id: string; device_label: string; os: string; capture_tool: string; teleprompter_placement: string; scene_presets: unknown; export_path: string | null }[];
  initialProjects: Project[];
  ytConnected: boolean;
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
      <div className="rounded-xl border border-border p-10 text-center">
        <p className="mb-4 text-sm text-muted-foreground">No video in progress.</p>
        <Button onClick={newProject} disabled={!profileId}>Start a new video</Button>
      </div>
    );
  }

  const stage = active.stage as StudioStage;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {STUDIO_STAGES.map((s) => (
            <span key={s} className={cn(
              "rounded-full px-3 py-1 text-[12px] font-medium",
              s === stage ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
            )}>{STAGE_LABEL[s]}</span>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={newProject}>New video</Button>
      </div>

      {stage === "topic" && <TopicBoard profileId={profileId} projectId={active.id} onChosen={() => patchActive({ stage: "script" })} />}
      {stage === "script" && <ScriptStudio projectId={active.id} script={active.script} onAdvance={() => patchActive({ stage: "record" })} onScript={(script) => patchActive({ script })} />}
      {stage === "record" && <RecordHub projectId={active.id} script={active.script} recordingProfiles={recordingProfiles} onConfirmed={() => patchActive({ stage: "publish" })} />}
      {stage === "publish" && <PublishPanel projectId={active.id} ytConnected={ytConnected} onPublished={(publish) => patchActive({ publish, stage: "repurposed" })} />}
      {stage === "repurposed" && <RepurposePanel projectId={active.id} publish={active.publish} />}
      {stage === "publish" && <RenderPanel />}
    </div>
  );
}
