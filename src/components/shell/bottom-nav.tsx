"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV } from "./nav-items";

/** Mobile tab bar — primary destinations only. Hidden on md+ (sidebar takes over). */
export function BottomNav() {
  const pathname = usePathname();
  const items = NAV.filter((n) => n.primary);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-sidebar pb-[env(safe-area-inset-bottom)] md:hidden">
      {items.map(({ href, icon: Icon, label }) => {
        const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
              isActive ? "text-brand-text" : "text-muted-foreground",
            )}
          >
            <Icon className="size-5" strokeWidth={1.7} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
