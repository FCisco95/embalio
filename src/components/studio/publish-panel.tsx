"use client";
import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { publishProjectVideo } from "@/server/studio/publish";

export function PublishPanel({ projectId, ytConnected, onPublished }: {
  projectId: string; ytConnected: boolean; onPublished: (p: { url: string }) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [publishing, startPublish] = useTransition();

  function publish() {
    if (!file) { toast.error("Choose your recorded MP4 first"); return; }
    startPublish(async () => {
      try {
        const fd = new FormData();
        fd.append("file", file);
        const up = await fetch("/api/studio/upload", { method: "POST", body: fd });
        if (!up.ok) throw new Error("upload failed");
        const { path } = (await up.json()) as { path: string };
        const result = await publishProjectVideo(projectId, path, window.location.origin);
        toast.success("Uploaded (private)");
        onPublished({ url: result.url });
      } catch (e) { toast.error(String(e)); }
    });
  }

  if (!ytConnected) {
    return (
      <Card><CardContent className="space-y-3 pt-5">
        <p className="text-[13px] text-muted-foreground">Connect your YouTube channel to publish.</p>
        <a href="/api/youtube/oauth/start" className={cn(buttonVariants())}>Connect YouTube</a>
      </CardContent></Card>
    );
  }

  return (
    <Card><CardContent className="space-y-3 pt-5">
      <p className="text-[13px] text-muted-foreground">Pick the MP4 you exported from OBS. Slice 1 always uploads as <strong>private</strong>.</p>
      <input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <Button onClick={publish} disabled={publishing || !file}>{publishing ? "Uploading…" : "Upload to YouTube (private)"}</Button>
    </CardContent></Card>
  );
}
