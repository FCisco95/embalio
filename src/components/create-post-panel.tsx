"use client";
import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ReachLintHints } from "@/components/reach-lint-hints";
import { StyledSelect } from "@/components/ui/select-native";
import { toast } from "sonner";
import { findHotTopics, draftPostFromAngle } from "@/server/create-post";
import { saveDraftToQueue } from "@/server/posts";

// Derive the trend shape from the server action so it can never drift from the schema.
type Trend = Awaited<ReturnType<typeof findHotTopics>>[number];

export function CreatePostPanel({ profiles }: { profiles: { id: string; handle: string }[] }) {
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? "");
  const [trends, setTrends] = useState<Trend[] | null>(null);
  const [draft, setDraft] = useState<string>("");
  const [finding, startFind] = useTransition();
  const [working, startWork] = useTransition();

  function topics() {
    startFind(async () => {
      try {
        setTrends(await findHotTopics(profileId));
      } catch (e) {
        toast.error(String(e));
      }
    });
  }

  function draftIt(t: Trend) {
    startWork(async () => {
      try {
        const d = await draftPostFromAngle(profileId, t.angle, t.source);
        setDraft(d.posts.join("\n\n"));
      } catch (e) {
        toast.error(String(e));
      }
    });
  }

  function save() {
    startWork(async () => {
      try {
        await saveDraftToQueue(profileId, { kind: "original", body: draft });
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
        <Button disabled={finding || !profileId} onClick={topics}>
          {finding ? "Finding hot topics…" : "Find hot topics"}
        </Button>
      </div>

      {trends?.map((t, i) => (
        <Card key={i}>
          <CardContent className="flex flex-col gap-2 pt-5">
            <div className="text-[14px] font-semibold">{t.topic}</div>
            <div className="text-[12px] text-muted-foreground">why now: {t.why_now}</div>
            <div className="text-[13px]">angle: {t.angle}</div>
            <div>
              <Button size="sm" disabled={working} onClick={() => draftIt(t)}>
                Draft this
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {trends && trends.length === 0 && (
        <p className="text-[13px] text-muted-foreground">No trends found — try again.</p>
      )}

      {draft && (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-5">
            <Textarea rows={5} value={draft} onChange={(e) => setDraft(e.target.value)} />
            <ReachLintHints text={draft} kind="post" />
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
              <Button size="sm" variant="secondary" disabled={working} onClick={save}>
                Save to queue
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
