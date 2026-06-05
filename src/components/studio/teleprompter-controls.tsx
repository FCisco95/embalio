"use client";
import { useEffect, useState } from "react";

// The Electron bridge surface this panel needs. In the browser the bridge is
// absent (or lacks controlOverlay) and the panel renders nothing — the overlay
// is a self-managed tab there.
type ControlBridge = {
  controlOverlay?: (action: string) => void;
  closeOverlay?: () => void;
  toggleInteractive?: () => void;
  onOverlayState?: (cb: (open: boolean) => void) => (() => void) | void;
};

function bridge(): ControlBridge | undefined {
  return (globalThis as { embalio?: ControlBridge }).embalio;
}

/**
 * Main-window control surface for the teleprompter overlay — the PRIMARY way to
 * drive the overlay with the mouse. Only renders inside Electron (bridge has
 * controlOverlay) AND while the overlay is open.
 */
export function TeleprompterControls() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const b = bridge();
    if (!b?.onOverlayState) return;
    const off = b.onOverlayState((v) => setOpen(v));
    return () => { if (off) off(); };
  }, []);

  const b = bridge();
  // Browser fallback (no Electron control bridge): render nothing.
  if (!b?.controlOverlay) return null;
  if (!open) return null;

  const send = (action: string) => b.controlOverlay?.(action);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3 text-[13px]">
      <Group label="overlay">
        <Chip onClick={() => b.toggleInteractive?.()}>Unlock/Lock</Chip>
        <Chip onClick={() => b.closeOverlay?.()}>Close</Chip>
      </Group>
      <Group label="session">
        <Chip onClick={() => send("session-start")}>Start session</Chip>
        <Chip onClick={() => send("session-export")}>Stop &amp; export</Chip>
      </Group>
      <Group label="text size">
        <Chip onClick={() => send("font-")}>−</Chip>
        <Chip onClick={() => send("font+")}>+</Chip>
      </Group>
      <Group label="lines">
        <Chip onClick={() => send("lines-")}>−</Chip>
        <Chip onClick={() => send("lines+")}>+</Chip>
      </Group>
      <Group label="backdrop">
        <Chip onClick={() => send("opacity-")}>−</Chip>
        <Chip onClick={() => send("opacity+")}>+</Chip>
      </Group>
      <Group label="width">
        <Chip onClick={() => send("width-")}>−</Chip>
        <Chip onClick={() => send("width+")}>+</Chip>
      </Group>
      <Group label="mode">
        <Chip onClick={() => send("mode")}>Sentence/Paragraph</Chip>
        <Chip onClick={() => send("mirror")}>Mirror</Chip>
      </Group>
      <Group label="save preset">
        <Chip onClick={() => send("preset-save-1")}>1</Chip>
        <Chip onClick={() => send("preset-save-2")}>2</Chip>
        <Chip onClick={() => send("preset-save-3")}>3</Chip>
      </Group>
      <Group label="recall preset">
        <Chip onClick={() => send("preset-1")}>1</Chip>
        <Chip onClick={() => send("preset-2")}>2</Chip>
        <Chip onClick={() => send("preset-3")}>3</Chip>
      </Group>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function Chip({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center rounded-md border border-border px-2 py-1 hover:border-primary"
    >
      {children}
    </button>
  );
}
