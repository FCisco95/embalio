import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"

interface TopbarProps {
  title: string
  actions?: React.ReactNode
}

export function Topbar({ title, actions }: TopbarProps) {
  return (
    <header
      className="sticky top-0 z-10 flex h-[60px] shrink-0 items-center gap-4 border-b border-border px-[18px]"
      style={{
        background: "color-mix(in oklch, var(--card) 75%, transparent)",
        backdropFilter: "blur(12px)",
      }}
    >
      <h1 className="flex-1 text-[15px] font-bold tracking-tight">{title}</h1>
      <div className="flex items-center gap-1">
        {actions}
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="size-4" strokeWidth={1.6} />
        </Button>
      </div>
    </header>
  )
}
