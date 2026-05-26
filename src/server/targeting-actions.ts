"use server";
import { refreshTargetsForProfile } from "./targeting";

export async function refreshTargets(profileId: string): Promise<number> {
  return refreshTargetsForProfile(profileId);
}
