/**
 * Presentational brand + platform metadata for the Dispatch-style shell chrome.
 *
 * This app is single-user, so the account switcher and platform tabs are
 * presentational (styled exactly like the Dispatch prototype) and wired to the
 * one real account rather than a multi-tenant brand list.
 */

export type PlatformId =
  | "x"
  | "linkedin"
  | "instagram"
  | "threads"
  | "youtube"
  | "tiktok"

export interface PlatformMeta {
  id: PlatformId
  name: string
  glyph: string
  color: string
}

export const PLATFORMS: Record<PlatformId, PlatformMeta> = {
  x: { id: "x", name: "X", glyph: "𝕏", color: "#e7e9ea" },
  linkedin: { id: "linkedin", name: "LinkedIn", glyph: "in", color: "#0a66c2" },
  instagram: { id: "instagram", name: "Instagram", glyph: "◎", color: "#e1306c" },
  threads: { id: "threads", name: "Threads", glyph: "@", color: "#cdd0d4" },
  youtube: { id: "youtube", name: "YouTube", glyph: "▶", color: "#ff0033" },
  tiktok: { id: "tiktok", name: "TikTok", glyph: "♪", color: "#25f4ee" },
}

export interface Brand {
  id: string
  handle: string
  name: string
  tagline: string
  plan: string
  /** Connected platforms — `livePlatform` is the one with a real connection. */
  platforms: PlatformId[]
  livePlatform: PlatformId
}

/** The single real account, dressed in Dispatch chrome. */
export const BRAND: Brand = {
  id: "cisco",
  handle: "@fcisco95",
  name: "Cisco",
  tagline: "Build-in-public · dev · crypto · AI",
  plan: "Pro plan",
  platforms: ["x", "linkedin", "threads", "youtube"],
  livePlatform: "x",
}
