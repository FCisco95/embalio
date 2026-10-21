import { getSetupProfileId } from "@/server/setup";
import { getActiveProfile } from "@/server/active-profile";
import { requireSessionUser } from "@/server/auth";
import { SetupQuiz } from "@/components/setup-quiz";

export const metadata = { title: "Set up your account" };

// Outside the (app) group, so it does NOT inherit that layout's force-dynamic.
// Must opt in explicitly: getSetupProfileId() reads/creates a profile at request
// time — static prerender would bake a build-time profile id into the HTML.
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  await requireSessionUser();
  // The quiz must target the account the user is looking at (cookie-active), not
  // the oldest one: finalizeSetup overwrites handle/niche/voice on that profile.
  // Only a user with no profile at all falls through to getSetupProfileId (creates one).
  const profileId = (await getActiveProfile())?.id ?? (await getSetupProfileId());
  return (
    <main className="min-h-screen bg-background text-foreground">
      <SetupQuiz profileId={profileId} />
    </main>
  );
}
