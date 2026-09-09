// Rendered by /setup on a pinned (FIXED_PROFILE_ID) deployment when the
// signed-in user owns no profile. The fix is one UPDATE, done by the operator
// in the Supabase SQL editor — the app deliberately does not do it for you,
// because the wrong link hides the wrong data.
import { signOutAction } from "@/server/auth-actions";
import { Button } from "@/components/ui/button";

export function UnlinkedAccountNotice({ userId, email }: { userId: string; email: string | null }) {
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-6 py-16">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">This account is not linked to a profile yet</h1>
        <p className="text-sm text-muted-foreground">
          This deployment is pinned to a single profile. Your sign-in{email ? ` (${email})` : ""} verified, but no
          profile row points at it, so setup will not create a fresh, empty one. Link the existing profile to this
          user and reload.
        </p>
      </div>
      <div className="rounded-2xl border border-border bg-surface-2 p-5 text-sm">
        <p className="mb-2 font-medium">Your auth user id</p>
        <code className="block break-all rounded-md bg-background px-3 py-2 text-xs">{userId}</code>
        <p className="mt-4 text-muted-foreground">
          Runbook: <code>docs/runbooks/2026-09-10-auth-merge-runbook.md</code> (step &quot;link the owner
          profile&quot;).
        </p>
      </div>
      <form action={signOutAction}>
        <Button type="submit" variant="ghost">Sign out</Button>
      </form>
    </div>
  );
}
