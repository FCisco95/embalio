"use client";
import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StyledSelect } from "@/components/ui/select-native";
import { toast } from "sonner";
import { findHotTopics, draftPostFromAngle } from "@/server/create-post";
import { saveDraftToQueue } from "@/server/posts";

type Trend = { topic: string; why_now: string; angle: string; source?: string };

export function CreatePostPanel({ profiles }: { profiles: { id: string; handle: string }[] }) {
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? "");
  const [trends, setTrends] = useState<Trend[] | null>(null);
  const [draft, setDraft] = useState<string>("");
  const [busy, start] = useTransition();

  function topics() {
    start(async () => {
      try {
        setTrends(await findHotTopics(profileId));
      } catch (e) {
        toast.error(String(e));
      }
    });
  }

  function draftIt(t: Trend) {
    start(async () => {
      try {
        const d = await draftPostFromAngle(profileId, t.angle, t.source);
        setDraft(d.posts.join("\n\n"));
      } catch (e) {
        toast.error(String(e));
      }
    });
  }

  function save() {
    start(async () => {
      try {
        await saveDraftToQueue(profileId, { kind: "original", body: draft.split("\n\n")[0] });
        toast.success("Saved to queue");
      } catch (e) {
        toast.error(String(e));
      }
    });
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <StyledSelect
          aria-label="Profile"
          value={profileId}
          onChange={(e) => setProfileId(e.target.value)}
        >
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.handle}
            </option>
          ))}
        </StyledSelect>
        <Button disabled={busy || !profileId} onClick={topics}>
          {busy ? "Finding hot topics…" : "Find hot topics"}
        </Button>
      </div>

      {trends?.map((t, i) => (
        <Card key={i}>
          <CardContent className="flex flex-col gap-2 pt-5">
            <div className="text-[14px] font-semibold">{t.topic}</div>
            <div className="text-[12px] text-muted-foreground">why now: {t.why_now}</div>
            <div className="text-[13px]">angle: {t.angle}</div>
            <div>
              <Button size="sm" disabled={busy} onClick={() => draftIt(t)}>
                Draft this
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {draft && (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-5">
            <Textarea rows={5} value={draft} onChange={(e) => setDraft(e.target.value)} />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(draft);
                  toast.success("Copied");
                }}
              >
                Copy
              </Button>
              <Button size="sm" variant="secondary" disabled={busy} onClick={save}>
                Save to queue
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
