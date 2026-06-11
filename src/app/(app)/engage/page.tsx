import { listProfiles } from "@/server/profiles";
import { getEngageQueue } from "@/server/engage-queue";
import { getSniperPins } from "@/server/sniper";
import { SniperPins } from "@/components/sniper-pins";
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
  const profiles = (await listProfiles()) ?? [];
  // Pre-load the first profile's surfaced candidates so the queue is populated on
  // open (the cron fills `candidates`; no scan-click needed for the dead-time loop).
  const initialItems = profiles[0] ? await getEngageQueue(profiles[0].id).catch(() => []) : [];
  const sniperPins = profiles[0] ? await getSniperPins(profiles[0].id).catch(() => []) : [];
  const { tab } = await searchParams;
  const activeTab =
    tab === "deepscan" ? "deepscan" : tab === "trends" ? "trends" : "engage";

  return (
    <PageShell title="Engage">
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
          {profiles[0] && (
            <div className="mb-3">
              <PushOptIn profileId={profiles[0].id} />
            </div>
          )}
          {profiles[0] && <SniperPins profileId={profiles[0].id} pins={sniperPins} />}
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
