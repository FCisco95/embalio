"use client";
import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { confirmTake } from "@/server/studio/projects";
import { DevicePicker } from "./device-picker";
import { PreshootGate } from "./preshoot-gate";
import type { VideoScript } from "@/lib/studio/schemas";

type RP = { id: string; device_label: string; os: string; capture_tool: string; teleprompter_placement: string; scene_presets: unknown; export_path: string | null };

export function RecordHub({ projectId, script, recordingProfiles, onConfirmed }: {
  projectId: string; script: unknown; recordingProfiles: RP[]; onConfirmed: () => void;
}) {
  const s = script as VideoScript | null;
  const [deviceProfileId, setDeviceProfileId] = useState(recordingProfiles[0]?.id ?? "");
  const [confirming, startConfirm] = useTransition();
  const active = recordingProfiles.find((rp) => rp.id === deviceProfileId);
  const scenes = Array.isArray(active?.scene_presets) ? (active!.scene_presets as string[]) : [];

  function confirm() {
    startConfirm(async () => {
      try { await confirmTake(projectId, deviceProfileId); toast.success("Take saved"); onConfirmed(); }
      catch (e) { toast.error(String(e)); }
    });
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => {
          const bridge = (globalThis as { embalio?: { openOverlay?: (id: string) => void } }).embalio;
          if (bridge?.openOverlay) bridge.openOverlay(projectId);                 // Electron: invisible overlay
          else window.open(`/overlay/record/${projectId}`, "_blank", "noreferrer"); // browser dev: tab
        }}
        className="inline-flex w-fit items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-[13px] hover:border-primary"
      >
        🎬 Launch teleprompter
      </button>
      <div className="flex flex-wrap items-center gap-3">
        <DevicePicker recordingProfiles={recordingProfiles} value={deviceProfileId} onChange={setDeviceProfileId} />
        {active && (
          <span className="text-[12px] text-muted-foreground">
            {active.capture_tool} · teleprompter: {active.teleprompter_placement}
            {scenes.length ? ` · scenes: ${scenes.join(", ")}` : ""}
            {active.export_path ? ` · save to ${active.export_path}` : ""}
          </span>
        )}
      </div>

      {active && <PreshootGate captureTool={active.capture_tool} />}

      {s && (
        <Card><CardContent className="space-y-3 pt-5">
          <div className="rounded-lg bg-secondary p-4 text-[15px] font-medium leading-relaxed">{s.hook}</div>
          <ol className="space-y-2">
            {s.beats.map((b, i) => (
              <li key={b.id} className="rounded-lg border border-border p-3">
                <div className="text-[14px]">{i + 1}. {b.say}</div>
                <div className="mt-1 text-[12px] text-muted-foreground">▶ {b.visualPrompt}</div>
              </li>
            ))}
          </ol>
        </CardContent></Card>
      )}

      <Button onClick={confirm} disabled={confirming || !deviceProfileId}>I recorded this take → Publish</Button>
    </div>
  );
}
