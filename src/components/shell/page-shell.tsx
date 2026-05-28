import { Topbar } from "./topbar"

interface PageShellProps {
  title: string
  actions?: React.ReactNode
  children: React.ReactNode
  padded?: boolean
}

export function PageShell({
  title,
  actions,
  children,
  padded = true,
}: PageShellProps) {
  return (
    <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
      <Topbar title={title} actions={actions} />
      <main className="flex-1 overflow-y-auto">
        {padded ? (
          <div className="max-w-[1180px] mx-auto px-8 py-7 pb-16">{children}</div>
        ) : (
          children
        )}
      </main>
    </div>
  )
}
