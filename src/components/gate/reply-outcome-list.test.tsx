// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
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
});
