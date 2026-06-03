"use client" // Error boundaries must be Client Components

import "./globals.css"

// Catches faults in the root layout itself (where (app)/error.tsx can't reach).
// Must provide its own <html>/<body> — it replaces the root layout when active.
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-background text-foreground">
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="max-w-md space-y-2">
            <h2 className="text-lg font-semibold">The app failed to load</h2>
            <p className="text-sm text-muted-foreground">
              {error.message || "An unexpected error occurred."}
            </p>
          </div>
          <button
            onClick={() => unstable_retry()}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
