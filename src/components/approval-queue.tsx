"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { extractTrailingLink } from "@/lib/posting/link-rule";
import { approveAndSchedule, editDraftBody, skipDraft } from "@/server/queue-actions";
import type { QueueDraft, XConnection } from "@/server/queue";

const LIMIT = 280;

/** ISO instant -> value for <input type="datetime-local"> in the viewer's timezone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Phone-first approval queue for the profile's pending ORIGINAL drafts.
 * Not wired into any page here: the home page renders it with `listQueueDrafts` + `getXConnection`.
 */
export function ApprovalQueue({
  profileId,
  drafts,
  x,
}: {
  profileId: string;
  drafts: QueueDraft[];
  x: XConnection;
}) {
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const canPublish = x.connected && !x.needsReauth;
  const visible = drafts.filter((d) => !removed.has(d.id));

  return (
    <section className="flex flex-col gap-3" data-profile-id={profileId} aria-label="Fila de aprovação">
      {!canPublish && (
        <p className="text-[13px] text-muted-foreground">
          {x.needsReauth ? "A ligação ao X precisa de nova autorização." : "Conta X deste perfil não ligada."}{" "}
          <Link href="/profiles" className="text-primary underline underline-offset-4">
            Abrir Contas
          </Link>
        </p>
      )}
      {visible.length === 0 && <p className="text-[13px] text-muted-foreground">Sem rascunhos na fila.</p>}
      {visible.map((d) => (
        <QueueCard
          key={d.id}
          draft={d}
          canPublish={canPublish}
          onRemove={() => setRemoved((prev) => new Set(prev).add(d.id))}
        />
      ))}
    </section>
  );
}

function QueueCard({
  draft,
  canPublish,
  onRemove,
}: {
  draft: QueueDraft;
  canPublish: boolean;
  onRemove: () => void;
}) {
  const [body, setBody] = useState(draft.body);
  const [when, setWhen] = useState("");
  const [whenLabel, setWhenLabel] = useState("");
  const [scheduledAt, setScheduledAt] = useState<string | null>(draft.status === "scheduled" ? draft.scheduled_at : null);
  const [deferred, setDeferred] = useState(false);
  const [lastError, setLastError] = useState<string | null>(draft.last_error);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const saved = useRef(draft.body);
  const saving = useRef<{ value: string; done: Promise<boolean> } | null>(null);

  // Time formatting depends on the viewer's timezone, so it is set after mount to
  // keep server-rendered and hydrated markup identical.
  useEffect(() => {
    setWhen(toLocalInput(draft.scheduled_at));
  }, [draft.scheduled_at]);
  const shownAt = scheduledAt ?? draft.scheduled_at;
  useEffect(() => {
    setWhenLabel(shownAt ? formatWhen(shownAt) : "");
  }, [shownAt]);

  const { text: tweetText, link_url: typedLink } = extractTrailingLink(body);
  const linkUrl = typedLink ?? draft.link_url;
  const count = tweetText.trim().length;

  /** Save an unsaved edit; concurrent callers (blur + click) share one request. */
  function flushEdit(): Promise<boolean> {
    if (body === saved.current) return Promise.resolve(true);
    if (saving.current?.value === body) return saving.current.done;
    const value = body;
    const done = (async () => {
      try {
        const r = await editDraftBody(draft.id, value);
        if (!r.ok) {
          setError(r.error);
          return false;
        }
        saved.current = value;
        return true;
      } catch (e) {
        setError(errMsg(e));
        return false;
      } finally {
        saving.current = null;
      }
    })();
    saving.current = { value, done };
    return done;
  }

  function run(fn: () => Promise<void>) {
    startTransition(async () => {
      setError(null);
      try {
        await fn();
      } catch (e) {
        setError(errMsg(e));
      }
    });
  }

  const publishNow = () =>
    run(async () => {
      if (!(await flushEdit())) return;
      const r = await approveAndSchedule(draft.id, null);
      if (!r.ok) return setError(r.error);
      if (r.published) return onRemove();
      // Queued for the ticker: keep the card visible so the state is not a silent disappearance.
      // With a reason the failure is real (not just "in a moment"): show it instead.
      setScheduledAt(new Date().toISOString());
      setDeferred(!r.reason);
      if (r.reason) setLastError(r.reason);
    });

  const schedule = () =>
    run(async () => {
      const at = new Date(when);
      if (!when || Number.isNaN(at.getTime())) return setError("Escolhe data e hora.");
      if (!(await flushEdit())) return;
      const r = await approveAndSchedule(draft.id, at.toISOString());
      if (!r.ok) return setError(r.error);
      setScheduledAt(at.toISOString());
      setDeferred(false);
      setLastError(null);
    });

  const skip = () =>
    run(async () => {
      const r = await skipDraft(draft.id);
      if (!r.ok) return setError(r.error);
      onRemove();
    });

  return (
    <Card size="sm" className="px-3" data-draft-id={draft.id}>
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        // Deliberately not inside the transition: a blur-triggered pending state would
        // disable the button under the user's finger and swallow the tap that caused the blur.
        onBlur={() => void flushEdit()}
        aria-label="Texto do post"
        disabled={pending}
        rows={4}
      />
      <div className="flex items-start justify-between gap-3 text-[12px] text-muted-foreground">
        <div className="flex min-w-0 flex-col gap-0.5">
          {draft.angle && <span>{draft.angle}</span>}
          {draft.rationale && <span>{draft.rationale}</span>}
          {linkUrl && (
            <span className="truncate">
              link → reply 1: {linkUrl}
            </span>
          )}
          {scheduledAt ? (
            <span>{deferred ? "Agendado: publica em instantes" : `Agendado para ${whenLabel}`}</span>
          ) : (
            draft.scheduled_at && <span>Sugerido: {whenLabel}</span>
          )}
          {lastError && <span className="text-destructive">Última falha: {lastError}</span>}
        </div>
        <span className={count > LIMIT ? "shrink-0 text-destructive" : "shrink-0"}>
          {count}/{LIMIT}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <Button disabled={pending || !canPublish} onClick={publishNow} className="h-10 w-full">
          Publicar agora
        </Button>
        <div className="flex items-center gap-2">
          <input
            type="datetime-local"
            aria-label="Data e hora"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            disabled={pending}
            className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-2 text-sm"
          />
          <Button variant="outline" disabled={pending || !canPublish} onClick={schedule} className="h-10">
            Agendar
          </Button>
          <Button variant="ghost" disabled={pending} onClick={skip} className="h-10">
            Saltar
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-[12px] text-destructive">
          {error}
        </p>
      )}
    </Card>
  );
}
