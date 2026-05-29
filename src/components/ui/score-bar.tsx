import { cn } from "@/lib/utils"

interface ScorePillProps {
  value: number
  className?: string
}

export function ScorePill({ value, className }: ScorePillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-[12px] font-semibold text-brand-text",
        className
      )}
      style={{
        background: `color-mix(in oklch, var(--primary) ${value * 0.22}%, transparent)`,
        borderColor: `color-mix(in oklch, var(--primary) 30%, transparent)`,
      }}
    >
      {value}
    </span>
  )
}

interface ScoreBarProps {
  value: number
  className?: string
}

export function ScoreBar({ value, className }: ScoreBarProps) {
  const clamped = Math.min(100, Math.max(0, value))
  return (
    <div className={cn("h-1.5 w-[100px] rounded-full bg-muted overflow-hidden", className)}>
      <div
        className="h-full rounded-full bg-primary/70 transition-all"
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}
