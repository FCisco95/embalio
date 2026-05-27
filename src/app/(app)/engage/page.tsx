import { listProfiles } from "@/server/profiles";
import { ReplyQueuePanel } from "@/components/reply-queue";

export default async function EngagePage() {
  const profiles = (await listProfiles()) ?? [];
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-1">Engage</h1>
      <p className="text-sm text-muted-foreground mb-4">Reply opportunities from your seed accounts in the last 24h.</p>
      <ReplyQueuePanel profiles={profiles} />
    </div>
  );
}
