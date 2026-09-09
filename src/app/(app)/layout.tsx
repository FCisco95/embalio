import { AppShell } from "@/components/shell/app-shell"
import { requireCurrentProfile } from "@/server/auth"
import { listPendingDrafts } from "@/server/posts"

// The app shell depends on the request-time Supabase session and current profile.
export const dynamic = "force-dynamic"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireCurrentProfile()
  let pending = 0
  try { pending = (await listPendingDrafts(profile.id)).length } catch {}

  return <AppShell badges={{ "/compose": pending || undefined }}>{children}</AppShell>
}
