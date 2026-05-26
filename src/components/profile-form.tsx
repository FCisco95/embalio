"use client";
import { useState } from "react";
import { createProfile } from "@/server/profiles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export function ProfileForm() {
  const [handle, setHandle] = useState("");
  const [niche, setNiche] = useState("");
  const [corpus, setCorpus] = useState("");
  const [notes, setNotes] = useState("");

  async function submit() {
    try {
      await createProfile({
        handle, niche_description: niche, voice_notes: notes,
        voice_corpus: corpus.split("\n").map((s) => s.trim()).filter(Boolean),
      });
      toast.success("Profile created");
      setHandle(""); setNiche(""); setCorpus(""); setNotes("");
    } catch (e) { toast.error(String(e)); }
  }

  return (
    <div className="space-y-3 max-w-xl">
      <Input placeholder="@handle" value={handle} onChange={(e) => setHandle(e.target.value)} />
      <Input placeholder="Niche (e.g. crypto/dev/AI builder)" value={niche} onChange={(e) => setNiche(e.target.value)} />
      <Textarea rows={8} placeholder="Paste 20-50 of this account's best posts, one per line" value={corpus} onChange={(e) => setCorpus(e.target.value)} />
      <Textarea rows={3} placeholder="Style guardrails (tone, do/don't, slang)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <Button onClick={submit}>Create profile</Button>
    </div>
  );
}
