import { listProfiles } from "@/server/profiles";
import { WeeklyComposer } from "@/components/weekly-composer";
import { PageShell } from "@/components/shell/page-shell";

export default async function ComposePage() {
  const profiles = (await listProfiles()) ?? [];
  return (
    <PageShell title="Compose">
      <WeeklyComposer profiles={profiles} />
    </PageShell>
  );
}
