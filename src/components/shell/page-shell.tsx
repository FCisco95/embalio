interface PageShellProps {
  title?: string
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  /** When false, the page controls its own layout (no centered container). */
  padded?: boolean
}

/**
 * Per-screen content scaffold. The global topbar/sidebar live in AppShell;
 * PageShell just renders the centered content column and (optionally) the
 * in-content H1 title — matching the Dispatch prototype's `.dx-screen`.
 */
export function PageShell({ title, subtitle, actions, children, padded = true }: PageShellProps) {
  if (!padded) return <>{children}</>

  return (
    <div className="mx-auto max-w-content px-[30px] pb-[60px] pt-[26px] max-md:px-4">
      {(title || actions) && (
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            {title && (
              <h1 className="text-2xl font-bold tracking-[-0.02em]">{title}</h1>
            )}
            {subtitle && (
              <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {actions}
        </div>
      )}
      {children}
    </div>
  )
}
