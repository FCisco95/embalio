import { cn } from "@/lib/utils"

function getHue(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash + name.charCodeAt(i)) % 360
  }
  return hash
}

interface BrandAvatarProps {
  name: string
  /** "sm" = 28px, "md" = 36px, or an explicit pixel size. */
  size?: "sm" | "md" | number
  /** Override the hash-derived gradient (e.g. the brand's signature gradient). */
  gradient?: string
  /** Override the derived initials. */
  initials?: string
  className?: string
}

export function BrandAvatar({ name, size = "sm", gradient, initials, className }: BrandAvatarProps) {
  const hue = getHue(name)
  const text =
    initials ??
    (name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") ||
      name[0]?.toUpperCase() ||
      "?")

  const px = typeof size === "number" ? size : size === "sm" ? 28 : 36
  const style: React.CSSProperties = {
    background:
      gradient ??
      `linear-gradient(135deg, hsl(${hue}deg 65% 50%), hsl(${(hue + 40) % 360}deg 70% 45%))`,
  }
  if (typeof size === "number") {
    style.width = px
    style.height = px
    style.borderRadius = px * 0.32
    style.fontSize = px * 0.4
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center shrink-0 font-bold text-white tracking-tight",
        typeof size !== "number" &&
          (size === "sm" ? "size-7 rounded-md text-[11px]" : "size-9 rounded-lg text-[13px]"),
        className
      )}
      style={style}
    >
      {text}
    </div>
  )
}

/** The signature brand gradient used for the primary account avatar. */
export const BRAND_GRADIENT = "linear-gradient(135deg,#6366f1,#a855f7)"
