import { listProfiles } from "@/server/profiles";
import { WeeklyComposer } from "@/components/weekly-composer";
import { ThreadComposer } from "@/components/thread-composer";
import { CreatePostPanel } from "@/components/create-post-panel";
import { PageShell } from "@/components/shell/page-shell";
import { tabClass } from "@/lib/tab-class";

export default async function ComposePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; mode?: string }>;
}) {
  const profiles = (await listProfiles()) ?? [];
  const { tab, mode } = await searchParams;

  const activeTab = tab === "create" ? "create" : "compose";

  const isThread = activeTab === "compose" && mode === "thread";

  return (
    <PageShell title="Composer">
      <div className="flex gap-1 border-b border-border mb-6">
        <a href="/compose" className={tabClass("compose", activeTab)}>
          Composer
        </a>
        <a href="/compose?tab=create" className={tabClass("create", activeTab)}>
          Create post
        </a>
      </div>

      {activeTab === "compose" && (
        <>
          <p className="text-[13px] text-muted-foreground mb-4">
            {isThread
              ? "Turn a topic or briefing insight into a full thread."
              : "Type a topic, generate an on-brand draft, then copy or mark as posted."}
          </p>
          {isThread ? (
            <ThreadComposer profiles={profiles} />
          ) : (
            <WeeklyComposer profiles={profiles} />
          )}
        </>
      )}

      {activeTab === "create" && (
        <>
          <p className="text-[13px] text-muted-foreground mb-4">
            Find trending angles and generate a ready-to-post draft.
          </p>
          <CreatePostPanel profiles={profiles} />
        </>
      )}
    </PageShell>
  );
}
