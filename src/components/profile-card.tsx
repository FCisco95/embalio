import { listSeedTargets, addSeedTarget } from "@/server/profiles";
import { Card } from "@/components/ui/card";

export async function ProfileCard({ profile }: { profile: { id: string; handle: string; niche_description: string | null } }) {
  const targets = await listSeedTargets(profile.id);
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
    </Card>
  );
}
