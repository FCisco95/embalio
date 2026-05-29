interface PersonAvatarProps {
  /** Display name or handle — drives the initial and the hue. */
  name?: string
  handle?: string
  size?: number
}

const HUES = [210, 280, 330, 20, 160, 250]

/** Circular gradient avatar with a hue derived from the handle (per Dispatch). */
export function PersonAvatar({ name, handle, size = 38 }: PersonAvatarProps) {
  const key = handle || name || "x"
  const hue = HUES[key.length % HUES.length]
  const initial = (name || handle || "?").replace("@", "")[0]?.toUpperCase() ?? "?"

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: `linear-gradient(135deg, oklch(0.62 0.14 ${hue}), oklch(0.5 0.16 ${hue + 40}))`,
      }}
    >
      {initial}
    </div>
  )
}
