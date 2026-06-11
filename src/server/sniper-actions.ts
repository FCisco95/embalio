"use server";
import { markSniperAlert } from "@/server/sniper";

export async function actOnSniperAlert(
  profileId: string,
  alertId: string,
  action: "acted" | "dismissed",
): Promise<void> {
  await markSniperAlert(profileId, alertId, action);
}
