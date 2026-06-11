import { listProfiles } from "@/server/profiles";
import { PageShell } from "@/components/shell/page-shell";
import { TopicBoard } from "@/components/topics/topic-board";

export default async function TopicsPage() {
  const profiles = (await listProfiles()) ?? [];

  return (
    <PageShell
      title="Topics"
      subtitle="Score-ranked post ideas ready to draft — refreshed automatically."
    >
      <TopicBoard profiles={profiles} />
    </PageShell>
  );
}
