import { requireActiveProfile } from "@/server/active-profile";
import { PageShell } from "@/components/shell/page-shell";
import { TopicBoard } from "@/components/topics/topic-board";

export default async function TopicsPage() {
  // TopicBoard takes a profile list; hand it only the active account.
  const profiles = [await requireActiveProfile()];

  return (
    <PageShell
      title="Topics"
      subtitle="Score-ranked post ideas ready to draft — refreshed automatically."
    >
      <TopicBoard profiles={profiles} />
    </PageShell>
  );
}
