"use client";
import { useState } from "react";
import { proposeAnglesForPillars, composeOriginalForProfile, getProfilePillars } from "@/server/original";
import type { Angle } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export function AngleComposer({ profiles }: { profiles: { id: string; handle: string }[] }) {
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? "");
  const [angles, setAngles] = useState<Angle[]>([]);
  const [body, setBody] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function research() {
    setBusy(true);
    try {
      const pillars = await getProfilePillars(profileId);
      if (pillars.length === 0) { toast.error("Run onboarding first to set content pillars"); return; }
      setAngles(await proposeAnglesForPillars(pillars));
    } catch (e) { toast.error(String(e)); } finally { setBusy(false); }
  }
  async function pick(angle: Angle) {
    setBusy(true);
    try { const { draft } = await composeOriginalForProfile(profileId, angle); setBody(draft.posts.join("\n\n")); toast.success("Drafted"); }
    catch (e) { toast.error(String(e)); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-3 max-w-xl">
      <select className="border rounded px-2 py-1" value={profileId} onChange={(e) => setProfileId(e.target.value)}>
        {profiles.map((p) => <option key={p.id} value={p.id}>{p.handle}</option>)}
      </select>
      <Button disabled={busy} onClick={research}>{busy ? "Researching…" : "Research angles"}</Button>
      {angles.length > 0 && (
        <div className="space-y-2">
          {angles.map((a, i) => (
            <div key={i} className="border rounded p-2 text-sm flex items-center justify-between gap-2">
              <span><span className="text-muted-foreground">[{a.mode}]</span> {a.hook}</span>
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => pick(a)}>Draft this</Button>
            </div>
          ))}
        </div>
      )}
      {body && (
        <div className="space-y-2">
          <Textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
          <Button size="sm" onClick={() => { navigator.clipboard.writeText(body); toast.success("Copied"); }}>Copy</Button>
        </div>
      )}
    </div>
  );
}
