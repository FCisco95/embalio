export function fixedProfileMismatch(profileId: string): boolean {
  const fixed = process.env.FIXED_PROFILE_ID;
  return Boolean(fixed) && profileId !== fixed;
}

export function assertFixedProfileAccess(profileId: string): void {
  if (fixedProfileMismatch(profileId)) throw new Error("profile_id mismatch");
}
