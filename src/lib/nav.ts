import {
  LayoutDashboard,
  CalendarDays,
  FileText,
  FilePlus2,
  FolderOpen,
  Laptop,
  ShieldCheck,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type Role = "EMPLOYEE" | "SUPERVISEUR" | "MANAGER" | "ADMIN";

/** Sidebar grouping. Personal day-to-day routes sit apart from admin tools. */
export type NavSection = "espace" | "gestion";

export const SECTION_LABELS: Record<NavSection, string> = {
  espace: "Mon espace",
  gestion: "Gestion",
};

export type NavItem = {
  href: string;
  icon: LucideIcon;
  label: string;
  roles: Role[];
  /** Which sidebar group this item belongs to. */
  section: NavSection;
  /** Show in the mobile bottom tab bar (keep this to ~4 most-used routes). */
  primary?: boolean;
  /** Active only on an exact path match (not sub-routes). Use when another nav
   *  item owns a deeper path under this one — e.g. /admin vs /admin/dossiers. */
  exact?: boolean;
};

/**
 * Single source of truth for navigation.
 * Consumed by the desktop Sidebar, the mobile drawer (MobileNav),
 * and the BottomTabBar — define a route once, it appears everywhere.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Tableau de Bord", roles: ["EMPLOYEE", "SUPERVISEUR", "MANAGER", "ADMIN"], section: "espace", primary: true },
  { href: "/conges", icon: CalendarDays, label: "Congés & Absences", roles: ["EMPLOYEE", "SUPERVISEUR", "MANAGER", "ADMIN"], section: "espace", primary: true },
  { href: "/teletravail", icon: Laptop, label: "Télétravail", roles: ["EMPLOYEE", "SUPERVISEUR", "MANAGER", "ADMIN"], section: "espace" },
  { href: "/paie", icon: FileText, label: "Bulletins de Paie", roles: ["EMPLOYEE", "SUPERVISEUR", "MANAGER", "ADMIN"], section: "espace", primary: true },
  { href: "/documents", icon: FilePlus2, label: "Documents", roles: ["EMPLOYEE", "SUPERVISEUR", "MANAGER", "ADMIN"], section: "espace", primary: true },
  { href: "/coffre-fort", icon: ShieldCheck, label: "Coffre-fort", roles: ["EMPLOYEE", "SUPERVISEUR", "MANAGER", "ADMIN"], section: "espace" },
  { href: "/admin/dossiers", icon: FolderOpen, label: "Dossiers Salariés", roles: ["SUPERVISEUR", "MANAGER", "ADMIN"], section: "gestion" },
  { href: "/admin", icon: Settings, label: "Administration", roles: ["MANAGER", "ADMIN"], section: "gestion", exact: true },
];

/** Nav items visible to a given role. */
export function navFor(role: string): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role as Role));
}

/**
 * Role's nav items bucketed into sidebar groups, empty groups dropped — an
 * EMPLOYEE sees a single ungrouped list, a MANAGER sees two labelled ones.
 */
export function navGroupsFor(role: string): { section: NavSection; items: NavItem[] }[] {
  const items = navFor(role);
  return (["espace", "gestion"] as NavSection[])
    .map((section) => ({ section, items: items.filter((i) => i.section === section) }))
    .filter((group) => group.items.length > 0);
}

/** Primary items for the mobile bottom tab bar, scoped to role. */
export function primaryNavFor(role: string): NavItem[] {
  return navFor(role).filter((item) => item.primary);
}

/** Page title derived from a pathname — used by the Header. */
export function titleFor(pathname: string): string {
  const match = NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/")
  );
  return match?.label ?? "Fair'Up OS";
}
