import { Home, Flame, Target, PenLine, Reply, LineChart, Users, Video, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  icon: LucideIcon;
  label: string;
  /** Show in the mobile bottom-nav (space is limited to ~5). */
  primary?: boolean;
  /**
   * Legacy / frozen surface. Reachable by URL and from the sidebar's "Labs"
   * group, never from the mobile tab bar. 2026-10 revamp: the daily loop is
   * Hoje · Replies · Performance · Contas; everything else is Labs.
   */
  labs?: boolean;
}

export const NAV: NavItem[] = [
  { href: "/",            icon: Home,      label: "Hoje",        primary: true },
  { href: "/engage",      icon: Reply,     label: "Replies",     primary: true },
  { href: "/performance", icon: LineChart, label: "Performance", primary: true },
  { href: "/profiles",    icon: Users,     label: "Contas",      primary: true },
  { href: "/topics",      icon: Flame,     label: "Topics",      labs: true },
  { href: "/compose",     icon: PenLine,   label: "Composer",    labs: true },
  { href: "/board",       icon: Target,    label: "Targeting",   labs: true },
  { href: "/studio",      icon: Video,     label: "Studio",      labs: true },
];
