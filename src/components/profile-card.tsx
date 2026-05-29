import { listSeedTargets, addSeedTarget } from "@/server/profiles";
import { getPostingAccount } from "@/server/posting";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BrandAvatar } from "@/components/ui/brand-avatar";
import { PostingConfig } from "@/components/posting-config";
import { OnboardingWizard } from "@/components/onboarding-wizard";

export async function ProfileCard({ profile }: { profile: { id: string; handle: string; niche_description: string | null } }) {
  const targets = await listSeedTargets(profile.id);
  const postingEnabled = process.env.NEXT_PUBLIC_POSTING_ENABLED === "true";
  const account = postingEnabled ? await getPostingAccount(profile.id) : null;

  return (
    <Card>
      <CardHeader className="border-b">
        <BrandAvatar name={profile.handle} size="md" className="row-span-2 self-center" />
        <CardTitle>{profile.handle}</CardTitle>
        {profile.niche_description && (
          <CardDescription className="truncate">{profile.niche_description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-4">
        <form
          action={async (fd: FormData) => {
            "use server";
            await addSeedTarget({ profile_id: profile.id, handle: String(fd.get("handle")) });
          }}
          className="flex gap-2 items-center"
        >
          <Input name="handle" placeholder="@seed_account" className="flex-1" />
          <Button type="submit" variant="accentSoft" size="sm">Add seed</Button>
        </form>
        <div className="flex items-center gap-2">
          <p className="text-[12px] text-muted-foreground">Seed targets</p>
          <Badge variant="secondary">{targets?.length ?? 0}</Badge>
        </div>
        {postingEnabled && <PostingConfig profileId={profile.id} current={account?.adspower_user_id} />}
        <OnboardingWizard profileId={profile.id} />
      </CardContent>
    </Card>
  );
}
