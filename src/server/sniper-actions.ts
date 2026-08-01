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

// Tenant guard for the sniper actions. These are public, unauthenticated POST
// endpoints (there is no auth layer: src/proxy.ts is a no-op), and they write to
// the dataset GATE-2 is judged on, so they get the same FIXED_PROFILE_ID check
// the rest of the repo uses (see profiles.ts:63).
//
// This is DEFENSE-IN-DEPTH, NOT a fix for audit finding F2. It stops writes
// aimed at another tenant, but it cannot stop an anonymous caller who passes the
// *correct* profile id — which is public. Closing F2 needs Vercel Deployment
// Protection or a real auth layer (F1).
// Decision record: docs/superpowers/plans/2026-08-02-f2-sniper-action-guards.md
function ownerMismatch(profileId: string): boolean {
  const fixed = process.env.FIXED_PROFILE_ID;
  return Boolean(fixed) && profileId !== fixed;
}

export async function actOnSniperAlert(
  profileId: string,
  alertId: string,
  action: "acted" | "dismissed",
  skipReason?: SkipReason | null,
): Promise<void> {
  if (ownerMismatch(profileId)) throw new Error("profile_id mismatch");
  await markSniperAlert(profileId, alertId, action, skipReason);
}

export async function confirmSentReply(
  profileId: string,
  alertId: string,
  sentText: string,
): Promise<void> {
  if (ownerMismatch(profileId)) throw new Error("profile_id mismatch");
  await markSniperReplySent(profileId, alertId, sentText);
}

export async function recordReplyOutcome(
  profileId: string,
  alertId: string,
  outcome: ReplyOutcomeInput,
): Promise<void> {
  if (ownerMismatch(profileId)) throw new Error("profile_id mismatch");
  await setReplyOutcome(profileId, alertId, outcome);
}

export async function createManualSniperAlert(
  profileId: string,
  input: ManualAlertInputType,
): Promise<ManualAlertResult> {
  // Result-union rather than a throw: this action's contract is never-throws
  // (the /engage form renders `reason`). The guard runs first so a rejected
  // caller never reaches the two embedding calls in createManualAlert.
  if (ownerMismatch(profileId)) return { ok: false, reason: "profile_id mismatch" };
  return createManualAlert(profileId, input);
}
