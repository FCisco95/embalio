import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface StyledSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  className?: string
}

export function StyledSelect({ className, children, ...props }: StyledSelectProps) {
  return (
    <div className="relative inline-flex items-center">
      <select
        className={cn(
          "appearance-none bg-background border border-border rounded-[10px] px-3 py-2 pr-8 text-[13.5px] text-foreground transition-colors outline-none cursor-pointer",
          "focus-visible:border-primary/50 focus-visible:ring-3 focus-visible:ring-[color-mix(in_oklch,var(--primary)_50%,var(--border))]",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 size-3.5 text-muted-foreground"
        strokeWidth={1.6}
      />
    </div>
  )
}
