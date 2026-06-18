import { listProfiles } from "@/server/profiles";
import { listWatchTargets } from "@/server/watch-targets";
import { TargetBoardPanel } from "@/components/target-board";
import { WatchTargetsCard } from "@/components/watch-targets-card";
import { StrategyBoard } from "@/components/strategy/strategy-board";
import { PageShell } from "@/components/shell/page-shell";

export default async function BoardPage() {
  const profiles = (await listProfiles()) ?? [];
  const watchTargets = profiles[0] ? await listWatchTargets(profiles[0].id).catch(() => []) : [];
  return (
    <PageShell
      title="Targeting board"
      subtitle="X accounts ranked by growth impact — who to follow and engage with today."
    >
      {profiles[0] && <WatchTargetsCard profileId={profiles[0].id} targets={watchTargets} />}
      <TargetBoardPanel profiles={profiles} />
      <StrategyBoard profiles={profiles} />
    </PageShell>
  );
}
