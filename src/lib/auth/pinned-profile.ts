// Single-tenant clamp meets auth.
//
// FIXED_PROFILE_ID pins the deployment to one profile row (the one holding the
// GATE-2 data). If a signed-in user owns no profile, /setup would otherwise
// auto-create a fresh "new-account" row for them — which, for the owner, means
// logging in and seeing an empty dashboard while the real data sits unlinked.
// On a pinned deployment that must be loud, not silent: block setup and tell
// the operator to link `profiles.user_id` to their auth user instead.

export function setupBlockedByPinnedProfile(input: { hasProfile: boolean; fixedProfileId: string | undefined }): boolean {
  return !input.hasProfile && Boolean(input.fixedProfileId);
}
