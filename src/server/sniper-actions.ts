"use server";
import { markSniperAlert, markSniperReplySent } from "@/server/sniper";

export async function actOnSniperAlert(
  profileId: string,
  alertId: string,
  action: "acted" | "dismissed",
): Promise<void> {
  await markSniperAlert(profileId, alertId, action);
}

export async function confirmSentReply(
  profileId: string,
  alertId: string,
  sentText: string,
): Promise<void> {
  await markSniperReplySent(profileId, alertId, sentText);
}
