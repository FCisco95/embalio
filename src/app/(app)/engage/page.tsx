import { listProfiles } from "@/server/profiles";
import { ReplyQueuePanel } from "@/components/reply-queue";
import { TrendRadarPanel } from "@/components/trend-radar";
import { PageShell } from "@/components/shell/page-shell";

export default async function EngagePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const profiles = (await listProfiles()) ?? [];
  const { tab } = await searchParams;
  const activeTab = tab === "trends" ? "trends" : "replies";

  return (
    <PageShell title="Engage">
      <div className="flex gap-1 border-b border-border mb-6">
        <a
          href="/engage"
          className={[
            "relative px-4 py-2 text-[13.5px] font-medium transition-colors",
            activeTab === "replies"
              ? "text-brand-text font-semibold after:absolute after:bottom-0 after:inset-x-0 after:h-0.5 after:bg-primary after:rounded-t"
              : "text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          Reply queue
        </a>
        <a
          href="/engage?tab=trends"
          className={[
            "relative px-4 py-2 text-[13.5px] font-medium transition-colors",
            activeTab === "trends"
              ? "text-brand-text font-semibold after:absolute after:bottom-0 after:inset-x-0 after:h-0.5 after:bg-primary after:rounded-t"
              : "text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          Trend radar
        </a>
      </div>

      {activeTab === "replies" && (
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
