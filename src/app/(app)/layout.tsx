import { AppShell } from "@/components/shell/app-shell"
import { requireActiveProfile } from "@/server/active-profile"
import { listProfiles } from "@/server/profiles"
import { listPendingDrafts } from "@/server/posts"

// The app shell depends on the request-time Supabase session and active profile.
export const dynamic = "force-dynamic"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [profiles, active] = await Promise.all([listProfiles(), requireActiveProfile()])
  let pending = 0
  try { pending = (await listPendingDrafts(active.id)).length } catch {}

  return (
    <AppShell
      badges={{ "/compose": pending || undefined }}
      // Only what the switcher renders crosses to the client — not voice corpora etc.
      profiles={(profiles ?? []).map(({ id, handle, display_name }) => ({ id, handle, display_name }))}
      activeId={active.id}
    >
      {children}
    </AppShell>
  )
}
