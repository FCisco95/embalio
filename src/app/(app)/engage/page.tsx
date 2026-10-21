import { requireActiveProfile } from "@/server/active-profile";
import { getEngageQueue } from "@/server/engage-queue";
import { getSniperPins } from "@/server/sniper";
import { SniperPins } from "@/components/sniper-pins";
import { ManualSniperForm } from "@/components/manual-sniper-form";
import { EngageQueuePanel } from "@/components/engage-queue-panel";
import { ReplyQueuePanel } from "@/components/reply-queue";
import { TrendRadarPanel } from "@/components/trend-radar";
import { PageShell } from "@/components/shell/page-shell";
import { tabClass } from "@/lib/tab-class";
import { PushOptIn } from "@/components/push-opt-in";

export default async function EngagePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const profile = await requireActiveProfile();
  // Panels take a profile list; hand them only the active account.
  const profiles = [profile];
  // Pre-load the active account's surfaced candidates so the queue is populated on
  // open (the cron fills `candidates`; no scan-click needed for the dead-time loop).
  const initialItems = await getEngageQueue(profile.id).catch(() => []);
  const sniperPins = await getSniperPins(profile.id).catch(() => []);
  const { tab } = await searchParams;
  const activeTab =
    tab === "deepscan" ? "deepscan" : tab === "trends" ? "trends" : "engage";

  return (
    <PageShell title="Replies">
      <div className="flex gap-1 border-b border-border mb-6">
        <a href="/engage" className={tabClass("engage", activeTab)}>
          Engage
        </a>
        <a href="/engage?tab=deepscan" className={tabClass("deepscan", activeTab)}>
          Deep scan
        </a>
        <a href="/engage?tab=trends" className={tabClass("trends", activeTab)}>
          Trend radar
        </a>
      </div>

      {activeTab === "engage" && (
        <>
          <div className="mb-3">
            <PushOptIn profileId={profile.id} />
          </div>
          <ManualSniperForm profileId={profile.id} />
          <SniperPins profileId={profile.id} pins={sniperPins} />
          <p className="text-[13px] text-muted-foreground mb-4">
            Scan seed accounts and draft replies in one step.
          </p>
          <EngageQueuePanel profiles={profiles} initialItems={initialItems} />
        </>
      )}

      {activeTab === "deepscan" && (
        <>
          <p className="text-[13px] text-muted-foreground mb-4">
            Reply opportunities from your seed accounts in the last 24h.
          </p>
          <ReplyQueuePanel profiles={profiles} />
        </>
      )}

      {activeTab === "trends" && (
        <>
          <p className="text-[13px] text-muted-foreground mb-4">
            2–3 niche trends right now with concrete post angles.
          </p>
          <TrendRadarPanel profiles={profiles} />
        </>
      )}
    </PageShell>
  );
}
