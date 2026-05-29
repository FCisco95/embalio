import { listProfiles } from "@/server/profiles";
import { WeeklyComposer } from "@/components/weekly-composer";
import { ThreadComposer } from "@/components/thread-composer";
import { PageShell } from "@/components/shell/page-shell";

export default async function ComposePage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const profiles = (await listProfiles()) ?? [];
  const { mode } = await searchParams;
  const isThread = mode === "thread";

  return (
    <PageShell
      title={isThread ? "Draft a thread" : "Composer"}
      subtitle={
        isThread
          ? "Turn a topic or briefing insight into a full thread."
          : "Type a topic, generate an on-brand draft, then copy or mark as posted."
      }
    >
      {isThread ? (
        <ThreadComposer profiles={profiles} />
      ) : (
        <WeeklyComposer profiles={profiles} />
      )}
    </PageShell>
  );
}
