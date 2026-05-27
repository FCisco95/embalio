"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { setPostingAccount } from "@/server/posting";

export function PostingConfig({ profileId, current }: { profileId: string; current?: string | null }) {
  const [val, setVal] = useState(current ?? "");
  return (
    <div className="mt-3 flex gap-2 items-center">
      <Input placeholder="AdsPower profile id" value={val} onChange={(e) => setVal(e.target.value)} className="text-sm" />
      <Button size="sm" variant="secondary" onClick={async () => {
        try { await setPostingAccount(profileId, val.trim()); toast.success("AdsPower profile saved"); }
        catch (e) { toast.error(String(e)); }
      }}>Save AdsPower</Button>
    </div>
  );
}
