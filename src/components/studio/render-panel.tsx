"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Scaffold only — the Shotstack render() seam is wired in slice 2.
export function RenderPanel() {
  return (
    <Card><CardContent className="space-y-2 pt-5">
      <div className="text-[12px] font-semibold uppercase text-muted-foreground">Render (coming next)</div>
      <p className="text-[13px] text-muted-foreground">
        Auto-composited intro/outro/captions over your face-cam via Shotstack. Not wired yet —
        publish your edited export directly for now.
      </p>
      <Button disabled>Render with Shotstack</Button>
    </CardContent></Card>
  );
}
