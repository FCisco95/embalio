import { getSetupProfileId } from "@/server/setup";
import { SetupQuiz } from "@/components/setup-quiz";

export const metadata = { title: "Set up your account" };

// Outside the (app) group, so it does NOT inherit that layout's force-dynamic.
// Must opt in explicitly: getSetupProfileId() reads/creates a profile at request
// time — static prerender would bake a build-time profile id into the HTML.
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const profileId = await getSetupProfileId();
  return (
    <main className="min-h-screen bg-background text-foreground">
      <SetupQuiz profileId={profileId} />
    </main>
  );
}
