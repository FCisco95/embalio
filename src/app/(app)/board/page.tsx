import { listProfiles } from "@/server/profiles";
import { TargetBoardPanel } from "@/components/target-board";
import { PageShell } from "@/components/shell/page-shell";

export default async function BoardPage() {
  const profiles = (await listProfiles()) ?? [];
  return (
    <PageShell
      title="Targeting board"
      subtitle="X accounts ranked by growth impact — who to follow and engage with today."
    >
      <TargetBoardPanel profiles={profiles} />
    </PageShell>
  );
}
