import { listSeedTargets, addSeedTarget } from "@/server/profiles";
import { getPostingAccount } from "@/server/posting";
import { Card } from "@/components/ui/card";
import { PostingConfig } from "@/components/posting-config";

export async function ProfileCard({ profile }: { profile: { id: string; handle: string; niche_description: string | null } }) {
  const targets = await listSeedTargets(profile.id);
  const postingEnabled = process.env.NEXT_PUBLIC_POSTING_ENABLED === "true";
  const account = postingEnabled ? await getPostingAccount(profile.id) : null;
  return (
    <Card className="p-4">
      <div className="font-medium">{profile.handle}</div>
      <div className="text-sm text-muted-foreground">{profile.niche_description}</div>
      <form
        action={async (fd: FormData) => {
          "use server";
          await addSeedTarget({ profile_id: profile.id, handle: String(fd.get("handle")) });
        }}
        className="mt-3 flex gap-2"
      >
        <input name="handle" placeholder="@seed_account" className="border rounded px-2 py-1 text-sm" />
        <button className="text-sm underline">add seed target</button>
      </form>
      <div className="mt-2 text-xs text-muted-foreground">{targets?.length ?? 0} seed targets</div>
      {postingEnabled && <PostingConfig profileId={profile.id} current={account?.adspower_user_id} />}
    </Card>
  );
}
