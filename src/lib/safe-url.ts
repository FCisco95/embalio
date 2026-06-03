// Guards against javascript:/data: URLs in href. Scraped tweet URLs and
// model-produced "source" links are untrusted; React renders a `javascript:`
// href verbatim (only a dev warning), so clicking one runs script in our origin.
// Return the URL only when it is http(s); otherwise undefined (renders inert).
export function safeHref(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    if (u.protocol === "http:" || u.protocol === "https:") return url;
  } catch {
    // not a parseable absolute URL
  }
  return undefined;
}
