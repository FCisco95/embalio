import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

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
    <Card interactive>
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="flex items-start justify-between gap-2">
          <div className="size-10 rounded-xl bg-surface-2 flex items-center justify-center text-2xl leading-none shrink-0">
            <span role="img" aria-label={title}>{emoji}</span>
          </div>
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
      </CardContent>
    </Card>
  )
}
