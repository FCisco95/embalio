// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

vi.mock("@/server/queue-actions", () => ({
  approveAndSchedule: vi.fn(),
  editDraftBody: vi.fn(),
  skipDraft: vi.fn(),
  unscheduleDraft: vi.fn(),
}));

import { ApprovalQueue } from "@/components/approval-queue";
import { approveAndSchedule, editDraftBody, skipDraft } from "@/server/queue-actions";
import type { QueueDraft, XConnection } from "@/server/queue";

const mApprove = vi.mocked(approveAndSchedule);
const mEdit = vi.mocked(editDraftBody);
const mSkip = vi.mocked(skipDraft);

const D1: QueueDraft = {
  id: "d1",
  body: "Retention is a product problem.",
  angle: "contrarian",
  rationale: "Replies to your last thread asked about churn",
  link_url: "https://example.com/post",
  scheduled_at: "2030-05-06T07:08:00.000Z",
  status: "draft",
  created_at: "2030-05-05T00:00:00.000Z",
};
const D2: QueueDraft = { ...D1, id: "d2", body: "Second draft", angle: null, rationale: null, link_url: null, scheduled_at: null };

const CONNECTED: XConnection = { connected: true, username: "cisco", needsReauth: false };

const renderQueue = (drafts: QueueDraft[] = [D1, D2], x: XConnection = CONNECTED) =>
  render(<ApprovalQueue profileId="p-1" drafts={drafts} x={x} />);

const cardOf = (text: string) => screen.getByDisplayValue(text).closest("[data-draft-id]") as HTMLElement;

afterEach(cleanup);
beforeEach(() => {
  mApprove.mockReset().mockResolvedValue({ ok: true, published: true });
  mEdit.mockReset().mockResolvedValue({ ok: true });
  mSkip.mockReset().mockResolvedValue({ ok: true });
});

describe("ApprovalQueue rendering", () => {
  it("renders one card per draft with body, angle, rationale and the link-as-reply note", () => {
    renderQueue();
    expect(screen.getAllByRole("textbox").filter((el) => el.tagName === "TEXTAREA")).toHaveLength(2);
    const c1 = within(cardOf("Retention is a product problem."));
    expect(c1.getByText("contrarian")).toBeTruthy();
    expect(c1.getByText(/churn/)).toBeTruthy();
    expect(c1.getByText(/link → reply 1/)).toBeTruthy();
    expect(c1.getByText(/example\.com\/post/)).toBeTruthy();
    const c2 = within(cardOf("Second draft"));
    expect(c2.queryByText(/link → reply 1/)).toBeNull();
  });

  it("shows the char count against 280, excluding a trailing link", () => {
    renderQueue([{ ...D1, body: "hello https://example.com/x" }]);
    expect(screen.getByText("5/280")).toBeTruthy();
  });

  it("prefills the schedule input from scheduled_at and shows the suggested time", () => {
    renderQueue([D1]);
    const input = within(cardOf("Retention is a product problem.")).getByLabelText(/data e hora/i) as HTMLInputElement;
    expect(input.type).toBe("datetime-local");
    expect(input.value).toMatch(/^2030-05-0[56]T\d\d:\d\d$/);
    expect(screen.getByText(/sugerido/i)).toBeTruthy();
  });

  it("shows an empty state", () => {
    renderQueue([]);
    expect(screen.getByText(/sem rascunhos/i)).toBeTruthy();
  });
});

describe("ApprovalQueue X connection gate", () => {
  it.each([
    ["not connected", { connected: false }],
    ["needs re-authorization", { connected: true, username: "cisco", needsReauth: true }],
  ])("disables publishing when X is %s, with a notice linking to /profiles", (_label, x) => {
    renderQueue([D1], x);
    expect((screen.getByRole("button", { name: "Publicar agora" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Agendar" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Saltar" }) as HTMLButtonElement).disabled).toBe(false);
    const link = screen.getByRole("link", { name: /perfis|contas|profiles|ligar|re-autorizar/i });
    expect(link.getAttribute("href")).toBe("/profiles");
  });

  it("shows no notice and enables publishing when connected", () => {
    renderQueue([D1]);
    expect((screen.getByRole("button", { name: "Publicar agora" }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("ApprovalQueue actions", () => {
  it("Publicar agora calls approveAndSchedule(id, null) and removes the card", async () => {
    renderQueue();
    fireEvent.click(within(cardOf("Retention is a product problem.")).getByRole("button", { name: "Publicar agora" }));
    await waitFor(() => expect(mApprove).toHaveBeenCalledWith("d1", null));
    await waitFor(() => expect(screen.queryByDisplayValue("Retention is a product problem.")).toBeNull());
    expect(screen.getByDisplayValue("Second draft")).toBeTruthy();
  });

  it("Publicar agora keeps a note instead of vanishing silently when the inline publish was deferred", async () => {
    mApprove.mockResolvedValue({ ok: true, published: false });
    renderQueue([D2]);
    fireEvent.click(screen.getByRole("button", { name: "Publicar agora" }));
    await waitFor(() => expect(screen.getByText(/agendado/i)).toBeTruthy());
    expect(screen.getByDisplayValue("Second draft")).toBeTruthy();
  });

  it("Agendar sends the chosen time as an ISO string", async () => {
    renderQueue([D2]);
    const input = screen.getByLabelText(/data e hora/i);
    fireEvent.change(input, { target: { value: "2030-05-06T07:08" } });
    fireEvent.click(screen.getByRole("button", { name: "Agendar" }));
    await waitFor(() => expect(mApprove).toHaveBeenCalledWith("d2", new Date("2030-05-06T07:08").toISOString()));
  });

  it("Agendar without a time asks for one and does not call the action", async () => {
    renderQueue([D2]);
    fireEvent.click(screen.getByRole("button", { name: "Agendar" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/data e hora/i));
    expect(mApprove).not.toHaveBeenCalled();
  });

  it("Saltar calls skipDraft and removes the card", async () => {
    renderQueue();
    fireEvent.click(within(cardOf("Second draft")).getByRole("button", { name: "Saltar" }));
    await waitFor(() => expect(mSkip).toHaveBeenCalledWith("d2"));
    await waitFor(() => expect(screen.queryByDisplayValue("Second draft")).toBeNull());
  });

  it("saves an edited body on blur via editDraftBody", async () => {
    renderQueue([D2]);
    const ta = screen.getByDisplayValue("Second draft");
    fireEvent.change(ta, { target: { value: "Second draft, sharper" } });
    fireEvent.blur(ta);
    await waitFor(() => expect(mEdit).toHaveBeenCalledWith("d2", "Second draft, sharper"));
  });

  it("does not call editDraftBody on blur when nothing changed", () => {
    renderQueue([D2]);
    fireEvent.blur(screen.getByDisplayValue("Second draft"));
    expect(mEdit).not.toHaveBeenCalled();
  });

  it("flushes an unsaved edit before publishing", async () => {
    const order: string[] = [];
    mEdit.mockImplementation(async () => (order.push("edit"), { ok: true }));
    mApprove.mockImplementation(async () => (order.push("approve"), { ok: true, published: true }));
    renderQueue([D2]);
    fireEvent.change(screen.getByDisplayValue("Second draft"), { target: { value: "edited" } });
    fireEvent.click(screen.getByRole("button", { name: "Publicar agora" }));
    await waitFor(() => expect(order).toEqual(["edit", "approve"]));
  });

  it("shows the server error inline and keeps the card", async () => {
    mApprove.mockResolvedValue({ ok: false, error: "body is 300 characters, the limit is 280" });
    renderQueue([D2]);
    fireEvent.click(screen.getByRole("button", { name: "Publicar agora" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/limit is 280/));
    expect(screen.getByDisplayValue("Second draft")).toBeTruthy();
  });

  it("a thrown action error is shown inline too", async () => {
    mSkip.mockRejectedValue(new Error("network"));
    renderQueue([D2]);
    fireEvent.click(screen.getByRole("button", { name: "Saltar" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/network/));
    expect(screen.getByDisplayValue("Second draft")).toBeTruthy();
  });

  it("an edit that fails to save blocks publishing and shows the error", async () => {
    mEdit.mockResolvedValue({ ok: false, error: "body is 300 characters, the limit is 280" });
    renderQueue([D2]);
    fireEvent.change(screen.getByDisplayValue("Second draft"), { target: { value: "x".repeat(300) } });
    fireEvent.click(screen.getByRole("button", { name: "Publicar agora" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/limit is 280/));
    expect(mApprove).not.toHaveBeenCalled();
  });
});
