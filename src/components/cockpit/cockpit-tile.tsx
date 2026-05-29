import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface CockpitTileProps {
  emoji: string
  title: string
  description: string
  href: string
  cta: string
  badgeLabel?: string
  badgeTone?: "good" | "warn" | "bad" | "accent"
}

export function CockpitTile({
  emoji,
  title,
  description,
  href,
  cta,
  badgeLabel,
  badgeTone = "accent",
}: CockpitTileProps) {
  return (
    <div className="card-interactive group flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-2">
        <span className="text-2xl leading-none" role="img" aria-label={title}>{emoji}</span>
        {badgeLabel && <Badge variant={badgeTone}>{badgeLabel}</Badge>}
      </div>
      <div className="flex flex-col gap-1.5 flex-1">
        <h3 className="text-[14px] font-semibold leading-snug">{title}</h3>
        <p className="text-[13px] text-muted-foreground leading-relaxed">{description}</p>
      </div>
      <Link href={href}>
        <Button variant="accentSoft" size="sm" className="w-full gap-2">
          {cta}
          <ArrowRight className="size-3.5" strokeWidth={1.6} />
        </Button>
      </Link>
    </div>
  )
}
