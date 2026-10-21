"use server";
import {
  markSniperAlert,
  markSniperReplySent,
  setReplyOutcome,
  createManualAlert,
  type ReplyOutcomeInput,
  type ManualAlertInputType,
  type ManualAlertResult,
} from "@/server/sniper";
import type { SkipReason } from "@/lib/gate/scorecard";
import { assertOwnProfile } from "@/server/auth";

// Tenant guard for the sniper actions. These are public POST endpoints that
// write to the dataset GATE-2 is judged on, so each one first proves the caller
// owns the profile (session user + RLS-scoped lookup) via assertOwnProfile.
// Decision record: docs/superpowers/plans/2026-08-02-f2-sniper-action-guards.md
export async function actOnSniperAlert(
  profileId: string,
  alertId: string,
  action: "acted" | "dismissed",
  skipReason?: SkipReason | null,
): Promise<void> {
  await assertOwnProfile(profileId);
  await markSniperAlert(profileId, alertId, action, skipReason);
}

export async function confirmSentReply(
  profileId: string,
  alertId: string,
  sentText: string,
): Promise<void> {
  await assertOwnProfile(profileId);
  await markSniperReplySent(profileId, alertId, sentText);
}

export async function recordReplyOutcome(
  profileId: string,
  alertId: string,
  outcome: ReplyOutcomeInput,
): Promise<void> {
  await assertOwnProfile(profileId);
  await setReplyOutcome(profileId, alertId, outcome);
}

export async function createManualSniperAlert(
  profileId: string,
  input: ManualAlertInputType,
): Promise<ManualAlertResult> {
  // Result-union rather than a throw: this action's contract is never-throws
  // (the /engage form renders `reason`). The guard runs first so a rejected
  // caller never reaches the two embedding calls in createManualAlert.
  try {
    await assertOwnProfile(profileId);
  } catch {
    return { ok: false, reason: "profile not found or access denied" };
  }
  return createManualAlert(profileId, input);
}
