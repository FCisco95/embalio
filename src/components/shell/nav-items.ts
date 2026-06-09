import { Home, Target, PenLine, Reply, LineChart, Settings2, Video, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  icon: LucideIcon;
  label: string;
  /** Show in the mobile bottom-nav (space is limited to ~5). */
  primary?: boolean;
}

export const NAV: NavItem[] = [
  { href: "/",            icon: Home,      label: "Home",        primary: true },
  { href: "/engage",      icon: Reply,     label: "Engage",      primary: true },
  { href: "/compose",     icon: PenLine,   label: "Composer",    primary: true },
  { href: "/board",       icon: Target,    label: "Targeting"                  },
  { href: "/performance", icon: LineChart, label: "Reach",       primary: true },
  { href: "/studio",      icon: Video,     label: "Studio"                     },
  { href: "/profiles",    icon: Settings2, label: "Brand Voice", primary: true },
];
