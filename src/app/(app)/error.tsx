"use client" // Error boundaries must be Client Components

import { ErrorState } from "@/components/ui/error-state"

// Wraps every page under the (app) shell. Renders inside the nav chrome so a
// thrown Server Action / RSC fault degrades to a recoverable panel, not a crash.
export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return <ErrorState error={error} retry={unstable_retry} />
}
