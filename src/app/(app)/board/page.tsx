import { listProfiles } from "@/server/profiles";
import { TargetBoardPanel } from "@/components/target-board";
import { PageShell } from "@/components/shell/page-shell";

export default async function BoardPage() {
  const profiles = (await listProfiles()) ?? [];
  return (
    <PageShell title="Board">
      <p className="text-[13px] text-muted-foreground mb-4">
        X accounts ranked by growth impact — who to follow and engage with today.
      </p>
      <TargetBoardPanel profiles={profiles} />
    </PageShell>
  );
}
