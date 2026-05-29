import { AppShell } from "@/components/shell/app-shell"
import { listProfiles } from "@/server/profiles"
import { listPendingDrafts } from "@/server/posts"

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
