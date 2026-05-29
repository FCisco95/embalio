import { listProfiles } from "@/server/profiles";
import { ProfileForm } from "@/components/profile-form";
import { ProfileCard } from "@/components/profile-card";
import { PageShell } from "@/components/shell/page-shell";

export default async function ProfilesPage() {
  const profiles = await listProfiles();
  return (
    <PageShell title="Voice">
      <div className="space-y-8">
        <section>
          <h2 className="text-base font-semibold mb-3">New profile</h2>
          <ProfileForm />
        </section>
        <section className="space-y-4">
          <h2 className="text-lg font-medium">Your profiles</h2>
          {(profiles ?? []).map((p) => <ProfileCard key={p.id} profile={p} />)}
          {(profiles ?? []).length === 0 && <p className="text-muted-foreground">No profiles yet — create one above.</p>}
        </section>
      </div>
    </PageShell>
  );
}
