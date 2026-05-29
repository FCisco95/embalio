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
  size?: "sm" | "md"
  className?: string
}

export function BrandAvatar({ name, size = "sm", className }: BrandAvatarProps) {
  const hue = getHue(name)
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || name[0]?.toUpperCase() || "?"

  return (
    <div
      className={cn(
        "flex items-center justify-center shrink-0 font-bold text-white",
        size === "sm" ? "size-7 rounded-md text-[11px]" : "size-9 rounded-lg text-[13px]",
        className
      )}
      style={{
        background: `linear-gradient(135deg, hsl(${hue}deg 65% 50%), hsl(${(hue + 40) % 360}deg 70% 45%))`,
      }}
    >
      {initials}
    </div>
  )
}
