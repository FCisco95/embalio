"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { approveDraft, postDraft } from "@/server/posting";

// Two-step gate: a draft must be explicitly Approved before it can be Posted to
// X via AdsPower. This stops injected/garbled drafted content from reaching X on
// a single stray click. postDraft() also enforces status === 'approved' server-side.
export function PostButton({ draftId, approved: initiallyApproved = false }: { draftId: string; approved?: boolean }) {
  const [approved, setApproved] = useState(initiallyApproved);
  const [pending, start] = useTransition();

  if (!approved) {
    return (
      <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => {
        try {
          await approveDraft(draftId);
          setApproved(true);
          toast.success("Approved — review, then post");
        } catch (e) { toast.error(String(e)); }
      })}>{pending ? "Approving…" : "Approve"}</Button>
    );
  }

  return (
    <Button size="sm" disabled={pending} onClick={() => start(async () => {
      try {
        const r = await postDraft(draftId);
        if (r.ok) toast.success("Posted via AdsPower");
        else toast.error(r.error ?? "Could not confirm post");
      } catch (e) { toast.error(String(e)); }
    })}>{pending ? "Posting…" : "Post via AdsPower"}</Button>
  );
}
