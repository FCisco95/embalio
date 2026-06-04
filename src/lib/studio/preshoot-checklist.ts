export interface ChecklistItem { id: string; label: string; }

/** Seeded from the Recording Profile 90-second checklist; extended per capture tool. */
export function checklistFor(captureTool: string): ChecklistItem[] {
  const base: ChecklistItem[] = [
    { id: "notifications", label: "Quiet room, phone on silent, Slack/Discord notifications closed" },
    { id: "mic-distance", label: "Mic ~15–20 cm from mouth, slightly off-axis (plosives)" },
    { id: "gain", label: "Audio peaks -12 to -6 dB — never red (run the 10s test below)" },
    { id: "framing", label: "Face well-lit (light in front), eyes ~upper third, head-and-shoulders" },
    { id: "scene", label: "OBS scene selected and recording armed" },
  ];
  if (/rapidemo/i.test(captureTool)) {
    base.push({ id: "rapidemo", label: "Rapidemo running for auto-zoom on the demo monitor" });
  }
  return base;
}

export function toggle(state: Record<string, boolean>, id: string): Record<string, boolean> {
  return { ...state, [id]: !state[id] };
}

export function allChecked(items: ChecklistItem[], state: Record<string, boolean>): boolean {
  return items.every((i) => state[i.id]);
}
