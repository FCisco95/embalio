import { getSetupProfileId } from "@/server/setup";
import { getCurrentProfile, requireSessionUser } from "@/server/auth";
import { setupBlockedByPinnedProfile } from "@/lib/auth/pinned-profile";
import { SetupQuiz } from "@/components/setup-quiz";
import { UnlinkedAccountNotice } from "@/components/unlinked-account-notice";

export const metadata = { title: "Set up your account" };

// Outside the (app) group, so it does NOT inherit that layout's force-dynamic.
// Must opt in explicitly: getSetupProfileId() reads/creates a profile at request
// time — static prerender would bake a build-time profile id into the HTML.
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const user = await requireSessionUser();
  // Pinned deployment + a user who owns no profile: do NOT auto-create an
  // empty one (that is the "dashboard looks wiped" failure). Say what to link.
  const existing = await getCurrentProfile();
  if (setupBlockedByPinnedProfile({ hasProfile: Boolean(existing), fixedProfileId: process.env.FIXED_PROFILE_ID })) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <UnlinkedAccountNotice userId={user.id} email={user.email ?? null} />
      </main>
    );
  }
  const profileId = await getSetupProfileId();
  return (
    <main className="min-h-screen bg-background text-foreground">
      <SetupQuiz profileId={profileId} />
    </main>
  );
}
