import { requireActiveProfile } from "@/server/active-profile";
import { listWatchTargets } from "@/server/watch-targets";
import { TargetBoardPanel } from "@/components/target-board";
import { WatchTargetsCard } from "@/components/watch-targets-card";
import { StrategyBoard } from "@/components/strategy/strategy-board";
import { PageShell } from "@/components/shell/page-shell";

export default async function BoardPage() {
  const profile = await requireActiveProfile();
  // Board panels take a profile list; hand them only the active account.
  const profiles = [profile];
  const watchTargets = await listWatchTargets(profile.id).catch(() => []);
  return (
    <PageShell
      title="Targeting board"
      subtitle="X accounts ranked by growth impact — who to follow and engage with today."
    >
      <WatchTargetsCard profileId={profile.id} targets={watchTargets} />
      <TargetBoardPanel profiles={profiles} />
      <StrategyBoard profiles={profiles} />
    </PageShell>
  );
}
