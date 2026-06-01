import { listProfiles } from "@/server/profiles";
import { EngageQueuePanel } from "@/components/engage-queue-panel";
import { ReplyQueuePanel } from "@/components/reply-queue";
import { TrendRadarPanel } from "@/components/trend-radar";
import { PageShell } from "@/components/shell/page-shell";
import { tabClass } from "@/lib/tab-class";

export default async function EngagePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const profiles = (await listProfiles()) ?? [];
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
          <p className="text-[13px] text-muted-foreground mb-4">
            Scan seed accounts and draft replies in one step.
          </p>
          <EngageQueuePanel profiles={profiles} />
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
