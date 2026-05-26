import { listProfiles } from "@/server/profiles";
import { listPerformance } from "@/server/posts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function PerformancePage({ searchParams }: { searchParams: Promise<{ profile?: string }> }) {
  const { profile } = await searchParams;
  const profiles = (await listProfiles()) ?? [];
  const active = profile ?? profiles[0]?.id;
  const posts = active ? ((await listPerformance(active)) ?? []) : [];
  return (
    <div className="p-6 space-y-3">
      <h1 className="text-xl font-semibold">Performance</h1>
      <div className="flex gap-2 text-sm">
        {profiles.map((p) => <a key={p.id} href={`/performance?profile=${p.id}`} className={p.id === active ? "font-semibold underline" : "underline"}>{p.handle}</a>)}
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Post</TableHead><TableHead>Kind</TableHead><TableHead>Likes</TableHead><TableHead>Views</TableHead><TableHead>Posted</TableHead></TableRow></TableHeader>
        <TableBody>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(posts as Array<Record<string, any>>).map((p) => (
            <TableRow key={p.id}>
              <TableCell className="max-w-md truncate"><a href={p.tweet_url} target="_blank" className="underline">{p.drafts?.body ?? p.tweet_url}</a></TableCell>
              <TableCell>{p.drafts?.kind}</TableCell>
              <TableCell>{p.metrics?.likes ?? "—"}</TableCell>
              <TableCell>{p.metrics?.views ?? "—"}</TableCell>
              <TableCell>{new Date(p.posted_at).toLocaleDateString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
