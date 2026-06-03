"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

interface ErrorStateProps {
  /** The thrown error forwarded by the route's error boundary. */
  error: Error & { digest?: string }
  /** Next 16.2 recovery: re-fetch + re-render the segment. */
  retry?: () => void
  title?: string
}

/**
 * Branded fallback shown when a route segment throws. Replaces the old
 * `toast.error(String(e))` pattern with a real, recoverable UI surface.
 */
export function ErrorState({ error, retry, title = "Something broke" }: ErrorStateProps) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="max-w-md space-y-2">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">
          {error.message || "An unexpected error occurred."}
        </p>
        {error.digest && (
          <p className="font-mono text-xs text-muted-foreground/70">ref: {error.digest}</p>
        )}
      </div>
      {retry && (
        <Button variant="outline" size="sm" onClick={() => retry()}>
          Try again
        </Button>
      )}
    </div>
  )
}
