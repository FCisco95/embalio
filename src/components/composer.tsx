"use client";
import { useState, useTransition } from "react";
import { composeOriginal } from "@/server/compose";
import { markPosted } from "@/server/posts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export function Composer({ profiles }: { profiles: { id: string; handle: string }[] }) {
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? "");
  const [topic, setTopic] = useState("");
  const [draft, setDraft] = useState<{ id: string; body: string; suggested_visual?: string } | null>(null);
  const [url, setUrl] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="space-y-3 max-w-xl">
      <select className="border rounded px-2 py-1" value={profileId} onChange={(e) => setProfileId(e.target.value)}>
        {profiles.map((p) => <option key={p.id} value={p.id}>{p.handle}</option>)}
      </select>
      <Input placeholder="Topic / angle" value={topic} onChange={(e) => setTopic(e.target.value)} />
      <Button disabled={pending} onClick={() => start(async () => {
        try { const d = await composeOriginal(profileId, topic); setDraft(d as { id: string; body: string; suggested_visual?: string }); } catch (e) { toast.error(String(e)); }
      })}>{pending ? "Drafting…" : "Draft post"}</Button>
      {draft && (
        <div className="space-y-2">
          <Textarea rows={4} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
          {draft.suggested_visual && <div className="text-xs text-muted-foreground">🖼 {draft.suggested_visual}</div>}
          <Button size="sm" onClick={() => { navigator.clipboard.writeText(draft.body); toast.success("Copied"); }}>Copy</Button>
          <div className="flex gap-2">
            <Input placeholder="paste posted tweet URL" value={url} onChange={(e) => setUrl(e.target.value)} />
            <Button size="sm" variant="secondary" onClick={async () => {
              try { await markPosted(draft.id, url); toast.success("Marked posted"); } catch (e) { toast.error(String(e)); }
            }}>Mark posted</Button>
          </div>
        </div>
      )}
    </div>
  );
}
