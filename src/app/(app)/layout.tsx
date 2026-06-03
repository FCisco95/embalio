import { AppShell } from "@/components/shell/app-shell"
import { listProfiles } from "@/server/profiles"
import { listPendingDrafts } from "@/server/posts"

// Every page reads per-request data from Supabase (service-role, no cookies), so
// none can be statically prerendered — doing so fails the build without env and
// would serve stale data on Vercel. Force dynamic for the whole app shell.
export const dynamic = "force-dynamic"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let pending = 0
  try {
    const profiles = await listProfiles()
    const profileId = profiles?.[0]?.id
    if (profileId) pending = (await listPendingDrafts(profileId)).length
  } catch {
    // Shell must render even if the DB is unreachable.
  }

  return <AppShell badges={{ "/compose": pending || undefined }}>{children}</AppShell>
}
