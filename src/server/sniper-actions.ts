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

export async function actOnSniperAlert(
  profileId: string,
  alertId: string,
  action: "acted" | "dismissed",
  skipReason?: SkipReason | null,
): Promise<void> {
  await markSniperAlert(profileId, alertId, action, skipReason);
}

export async function confirmSentReply(
  profileId: string,
  alertId: string,
  sentText: string,
): Promise<void> {
  await markSniperReplySent(profileId, alertId, sentText);
}

export async function recordReplyOutcome(
  profileId: string,
  alertId: string,
  outcome: ReplyOutcomeInput,
): Promise<void> {
  await setReplyOutcome(profileId, alertId, outcome);
}

export async function createManualSniperAlert(
  profileId: string,
  input: ManualAlertInputType,
): Promise<ManualAlertResult> {
  return createManualAlert(profileId, input);
}
