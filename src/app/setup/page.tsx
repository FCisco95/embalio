import { getSetupProfileId } from "@/server/setup";
import { SetupQuiz } from "@/components/setup-quiz";

export const metadata = { title: "Set up your account" };

export default async function SetupPage() {
  const profileId = await getSetupProfileId();
  return (
    <main className="min-h-screen bg-background text-foreground">
      <SetupQuiz profileId={profileId} />
    </main>
  );
}
