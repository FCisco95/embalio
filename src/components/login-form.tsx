"use client";

import { useActionState } from "react";
import { signInAction, signUpAction } from "@/server/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function AuthCard({
  title,
  subtitle,
  action,
  cta,
}: {
  title: string;
  subtitle: string;
  action: typeof signInAction;
  cta: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="space-y-4 rounded-2xl border border-border bg-surface-2 p-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <div className="space-y-3">
        <Input type="email" name="email" placeholder="you@example.com" autoComplete="email" />
        <Input type="password" name="password" placeholder="Password" autoComplete="current-password" />
      </div>
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Working..." : cta}
      </Button>
    </form>
  );
}

export function LoginForm() {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <AuthCard
        title="Sign in"
        subtitle="Use your Supabase Auth credentials."
        action={signInAction}
        cta="Sign in"
      />
      <AuthCard
        title="Create account"
        subtitle="Bootstrap a new authenticated owner account."
        action={signUpAction}
        cta="Create account"
      />
    </div>
  );
}
