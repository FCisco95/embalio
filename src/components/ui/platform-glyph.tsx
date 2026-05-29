import { PLATFORMS, type PlatformId } from "@/lib/brand"

interface PlatformGlyphProps {
  id: PlatformId
  size?: number
  muted?: boolean
}

/**
 * Per-platform colored glyph chip (X / LinkedIn / IG / Threads / YouTube / TikTok).
 * Hand-built to match the Dispatch prototype rather than using brand SVGs.
 */
export function PlatformGlyph({ id, size = 16, muted = false }: PlatformGlyphProps) {
  const p = PLATFORMS[id]
  if (!p) return null
  return (
    <span
      title={p.name}
      className="inline-flex items-center justify-center rounded-md font-bold leading-none"
      style={{
        width: size,
        height: size,
        fontSize: size * (id === "linkedin" ? 0.5 : 0.62),
        color: muted ? "var(--muted-foreground)" : p.color,
        fontFamily: id === "linkedin" ? "'Segoe UI', sans-serif" : "inherit",
      }}
    >
      {p.glyph}
    </span>
  )
}
