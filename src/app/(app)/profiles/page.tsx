import { listProfiles } from "@/server/profiles";
import { ProfileForm } from "@/components/profile-form";
import { ProfileCard } from "@/components/profile-card";
import { PageShell } from "@/components/shell/page-shell";
import { XOAuthBanner } from "@/components/x/oauth-banner";

export default async function ProfilesPage({
  searchParams,
}: {
  searchParams: Promise<{ x?: string; handle?: string; expected?: string; profile?: string }>;
}) {
  const [{ x, handle, expected, profile }, profiles] = await Promise.all([searchParams, listProfiles()]);
  return (
    <PageShell
      title="Contas"
      subtitle="Your voice spec, guardrails, and seed accounts."
    >
      <div className="space-y-10 max-w-2xl">
        <XOAuthBanner x={x} handle={handle} expected={expected} profile={profile} />
        <section>
          <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground mb-3">
            New profile
          </p>
          <ProfileForm />
        </section>
        <section className="space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground mb-3">
            Your profiles
          </p>
          {(profiles ?? []).map((p) => <ProfileCard key={p.id} profile={p} />)}
          {(profiles ?? []).length === 0 && (
            <p className="text-[13px] text-muted-foreground">No profiles yet — create one above.</p>
          )}
        </section>
      </div>
    </PageShell>
  );
}
