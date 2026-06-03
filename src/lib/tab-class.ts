/** Shared classes for the URL-param tab-bar idiom (engage + compose pages). */
export function tabClass(name: string, active: string): string {
  return [
    "relative px-4 py-2 text-[13.5px] font-medium transition-colors",
    active === name
      ? "text-brand-text font-semibold after:absolute after:bottom-0 after:inset-x-0 after:h-0.5 after:bg-primary after:rounded-t"
      : "text-muted-foreground hover:text-foreground",
  ].join(" ");
}
