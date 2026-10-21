"use client";
import { useState, useTransition } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { disconnectXAccount } from "@/server/x-accounts";

/**
 * The "X account" row of a profile card: link state + connect / re-authorize / disconnect.
 * The connect control is a plain <a> (not next/link): /api/x/oauth/start is a redirecting
 * route handler and must never be prefetched.
 */
export function ConnectXButton({
  profileId,
  connected,
  username,
  needsReauth,
}: {
  profileId: string;
  connected: boolean;
  username?: string;
  needsReauth?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const startHref = `/api/x/oauth/start?profile=${encodeURIComponent(profileId)}`;

  function disconnect() {
    startTransition(async () => {
      setError(null);
      try {
        await disconnectXAccount(profileId);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  const linkClass = cn(buttonVariants({ variant: "accentSoft", size: "sm" }));

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[12px] text-muted-foreground">
          X:{" "}
          {!connected ? (
            "não ligada"
          ) : (
            <span className="text-foreground">
              @{username} ({needsReauth ? "precisa re-autorizar" : "ok"})
            </span>
          )}
        </p>
        {!connected && (
          <a href={startHref} className={linkClass}>
            Ligar conta X
          </a>
        )}
        {connected && needsReauth && (
          <a href={startHref} className={linkClass}>
            Re-autorizar
          </a>
        )}
        {connected && (
          <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={disconnect}>
            Desligar
          </Button>
        )}
      </div>
      {(!connected || needsReauth) && (
        <p className="text-[11px] text-muted-foreground">
          Abre isto numa janela privada com sessão na conta X <em>deste</em> perfil, depois autoriza.
        </p>
      )}
      {error && (
        <p role="alert" className="text-[12px] text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
