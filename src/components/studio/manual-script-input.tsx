"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { readManualScript, writeManualScript, clearManualScript } from "@/lib/studio/manual-script";

/**
 * Type/paste your own text and send it to the teleprompter — it replaces the
 * generated script (sentence-by-sentence walking included) until cleared.
 */
export function ManualScriptInput() {
  const [text, setText] = useState(() => readManualScript() ?? "");
  const [activeText, setActiveText] = useState(() => readManualScript());

  const send = () => {
    const t = text.trim();
    if (!t) return;
    writeManualScript(t);
    setActiveText(t);
  };

  const clear = () => {
    clearManualScript();
    setActiveText(null);
  };

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
        <span>Manual script</span>
        {activeText !== null && <span className="rounded bg-primary/15 px-1.5 py-0.5 normal-case tracking-normal text-primary">live on teleprompter</span>}
      </div>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"Type or paste exactly what you want to say.\nOne chunk per line — press Enter to start a new chunk. In sentence mode, sentences inside a chunk are walked one by one."}
        rows={4}
        className="text-[13px]"
      />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={send} disabled={!text.trim()}>Send to teleprompter</Button>
        <Button size="sm" variant="outline" onClick={clear} disabled={activeText === null}>
          Clear (back to script)
        </Button>
      </div>
    </div>
  );
}
