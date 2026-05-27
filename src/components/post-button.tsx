"use client";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { postDraft } from "@/server/posting";

export function PostButton({ draftId }: { draftId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => {
      try {
        const r = await postDraft(draftId);
        if (r.ok) toast.success("Posted via AdsPower");
        else toast.error(r.error ?? "Could not confirm post");
      } catch (e) { toast.error(String(e)); }
    })}>{pending ? "Posting…" : "Post via AdsPower"}</Button>
  );
}
