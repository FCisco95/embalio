"use client";
import { useState, useTransition } from "react";
import { updatePostMetrics } from "@/server/posts";
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Metrics = { likes: number; reposts: number; replies: number; views: number };

const FIELDS: (keyof Metrics)[] = ["likes", "reposts", "replies", "views"];

export function MetricsRow({
  postId,
  body,
  metrics,
}: {
  postId: string;
  body: string;
  metrics: Partial<Metrics> | null;
}) {
  const [values, setValues] = useState<Metrics>({
    likes: metrics?.likes ?? 0,
    reposts: metrics?.reposts ?? 0,
    replies: metrics?.replies ?? 0,
    views: metrics?.views ?? 0,
  });
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();

  function set(field: keyof Metrics, raw: string) {
    setValues((v) => ({ ...v, [field]: Math.max(0, Math.floor(Number(raw) || 0)) }));
    setDirty(true);
  }

  function save() {
    start(async () => {
      try {
        await updatePostMetrics(postId, values);
        setDirty(false);
        toast.success("Metrics saved");
      } catch (e) {
        toast.error(String(e));
      }
    });
  }

  return (
    <TableRow>
      <TableCell className="max-w-[360px]">
        <div className="truncate text-[13px]">{body || "—"}</div>
      </TableCell>
      {FIELDS.map((f) => (
        <TableCell key={f} className="text-right">
          <input
            type="number"
            min={0}
            inputMode="numeric"
            aria-label={f}
            value={values[f]}
            onChange={(e) => set(f, e.target.value)}
            className="w-[72px] rounded-md border border-border bg-background px-2 py-1 text-right text-[13px] tabular-nums focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </TableCell>
      ))}
      <TableCell className="text-right">
        <Button size="sm" variant={dirty ? "default" : "ghost"} disabled={!dirty || pending} onClick={save}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </TableCell>
    </TableRow>
  );
}
