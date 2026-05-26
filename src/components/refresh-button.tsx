"use client";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { refreshTargets } from "@/server/targeting-actions";

export function RefreshButton({ profileId }: { profileId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button disabled={pending} onClick={() => start(async () => {
      try { const n = await refreshTargets(profileId); toast.success(`Surfaced ${n} targets`); }
      catch (e) { toast.error(String(e)); }
    })}>{pending ? "Refreshing…" : "Refresh targets"}</Button>
  );
}
