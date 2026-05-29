import { listProfiles } from "@/server/profiles";
import { ReplyQueuePanel } from "@/components/reply-queue";
import { PageShell } from "@/components/shell/page-shell";

export default async function EngagePage() {
  const profiles = (await listProfiles()) ?? [];
  return (
    <PageShell title="Engage">
      <p className="text-sm text-muted-foreground mb-4">Reply opportunities from your seed accounts in the last 24h.</p>
      <ReplyQueuePanel profiles={profiles} />
    </PageShell>
  );
}
