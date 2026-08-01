// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ManualSniperForm } from "@/components/manual-sniper-form";
import { createManualSniperAlert } from "@/server/sniper-actions";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
vi.mock("@/server/sniper-actions", () => ({ createManualSniperAlert: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mocked = createManualSniperAlert as unknown as ReturnType<typeof vi.fn>;

function open() {
  render(<ManualSniperForm profileId="p1" />);
  fireEvent.click(screen.getByText(/Manual sniper/i));
}

function fill() {
  const inputs = document.querySelectorAll("input, textarea");
  fireEvent.change(inputs[0], { target: { value: "https://x.com/a/status/1" } });
  const ta = document.querySelector("textarea");
  if (ta) fireEvent.change(ta, { target: { value: "some tweet text" } });
}

describe("ManualSniperForm success message", () => {
  // Pins render the top 5 by score from the last 3h (server/sniper.ts
  // getSniperPins), so a saved alert is NOT guaranteed to appear. The message
  // must not promise that it will.
  it("does not claim the alert is pinned below", async () => {
    mocked.mockResolvedValue({ ok: true, alertId: "a1", score: 0.62 });
    open();
    fill();
    fireEvent.click(screen.getByText(/Score/i));
    await waitFor(() => expect(screen.getByText(/score 62/i)).toBeTruthy());
    expect(screen.queryByText(/pinned below/i)).toBeNull();
  });

  it("says what actually governs the pin list", async () => {
    mocked.mockResolvedValue({ ok: true, alertId: "a1", score: 0.62 });
    open();
    fill();
    fireEvent.click(screen.getByText(/Score/i));
    await waitFor(() => expect(screen.getByText(/top 5/i)).toBeTruthy());
  });

  it("still surfaces an advisory drop reason", async () => {
    mocked.mockResolvedValue({ ok: true, alertId: "a1", score: 0.31, drop: "stale" });
    open();
    fill();
    fireEvent.click(screen.getByText(/Score/i));
    await waitFor(() => expect(screen.getByText(/your call/i)).toBeTruthy());
  });
});
