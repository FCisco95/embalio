// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ReplyOutcomeList } from "@/components/gate/reply-outcome-list";
import { recordReplyOutcome } from "@/server/sniper-actions";
import type { ActedAlertRow } from "@/server/gate";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
vi.mock("@/server/sniper-actions", () => ({ recordReplyOutcome: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const row = (o: Partial<ActedAlertRow> = {}): ActedAlertRow => ({
  id: "a1",
  author_handle: "kai",
  tweet_text: "big thread on agents",
  tweet_url: "https://x/1",
  // far from expiry unless a test overrides it
  created_at: "2026-07-28T10:00:00Z",
  sent_at: "2026-06-10T10:00:00Z",
  reply_impressions: null,
  author_median_reply_impressions: null,
  author_reply_back: null,
  ...o,
});

describe("ReplyOutcomeList", () => {
  it("renders an acted alert with outcome inputs", () => {
    render(<ReplyOutcomeList profileId="p1" alerts={[row()]} />);
    expect(screen.getByText("@kai")).toBeTruthy();
    expect(screen.getByText(/Your reply impressions/i)).toBeTruthy();
    expect(screen.getByText(/Save/)).toBeTruthy();
  });

  it("pre-fills existing recorded values", () => {
    render(<ReplyOutcomeList profileId="p1" alerts={[row({ reply_impressions: 1200 })]} />);
    expect((screen.getByDisplayValue("1200") as HTMLInputElement).value).toBe("1200");
  });

  it("Save records the outcome, mapping empty inputs to null", async () => {
    render(<ReplyOutcomeList profileId="p1" alerts={[row()]} />);
    fireEvent.click(screen.getByText("Save"));
    await waitFor(() =>
      expect(recordReplyOutcome).toHaveBeenCalledWith("p1", "a1", {
        replyImpressions: null,
        authorMedianReplyImpressions: null,
        authorReplyBack: null,
      }),
    );
  });

  it("shows an empty state with no acted alerts", () => {
    render(<ReplyOutcomeList profileId="p1" alerts={[]} />);
    expect(screen.getByText(/No acted replies yet/i)).toBeTruthy();
  });

  // The scorecard window is rolling, so evidence ages out on a fixed date.
  // Pinned clock: these assertions are about calendar distance, not "now".
  describe("window-expiry warning", () => {
    const NOW = new Date("2026-08-02T00:00:00Z");
    const CREATED_41D_AGO = "2026-06-22T00:00:00Z"; // 4 days left in a 45d window

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(NOW);
    });
    afterEach(() => vi.useRealTimers());

    it("warns when an alert is about to leave the scorecard window", () => {
      render(<ReplyOutcomeList profileId="p1" alerts={[row({ created_at: CREATED_41D_AGO })]} windowDays={45} />);
      expect(screen.getByText(/leaves the scorecard in 4d/i)).toBeTruthy();
    });

    it("says so once an alert has already aged out", () => {
      render(<ReplyOutcomeList profileId="p1" alerts={[row({ created_at: "2026-06-01T00:00:00Z" })]} windowDays={45} />);
      expect(screen.getByText(/outside the window/i)).toBeTruthy();
    });

    it("stays quiet for alerts with plenty of window left", () => {
      render(<ReplyOutcomeList profileId="p1" alerts={[row()]} windowDays={45} />);
      expect(screen.queryByText(/leaves the scorecard/i)).toBeNull();
    });

    it("a widened window silences a warning the default window would show", () => {
      render(<ReplyOutcomeList profileId="p1" alerts={[row({ created_at: CREATED_41D_AGO })]} windowDays={365} />);
      expect(screen.queryByText(/leaves the scorecard/i)).toBeNull();
    });
  });
});
