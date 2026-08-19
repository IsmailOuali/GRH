"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Menu, X, Building2 } from "lucide-react";
import { navGroupsFor, SECTION_LABELS, titleFor } from "@/lib/nav";
import { cn } from "@/lib/utils";
import type { NotificationItem, PendingReminder } from "@/lib/notifications";
import { NavLink } from "./NavLink";
import { LogoutButton } from "./LogoutButton";
import { NotificationBell } from "./NotificationBell";
import { initials } from "./Sidebar";

const ROLE_LABELS: Record<string, string> = {
  EMPLOYEE: "Salarié",
  SUPERVISEUR: "Superviseur",
  MANAGER: "Responsable",
  ADMIN: "Directeur",
};

type MobileNavProps = {
  role: string;
  name: string;
  company: string;
  counts?: Record<string, number>;
  notifications?: NotificationItem[];
  unreadCount?: number;
  reminders?: PendingReminder[];
};

/**
 * Mobile-only top bar with a hamburger that opens a pure-CSS slide-in drawer.
 * No dialog library — overlay + panel are plain Tailwind transitions, so this
 * adds zero runtime dependencies and avoids the Base-UI `asChild` gotcha.
 */
export function MobileNav({
  role,
  name,
  company,
  counts = {},
  notifications = [],
  unreadCount = 0,
  reminders = [],
}: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const groups = navGroupsFor(role);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const canSwitch = role === "MANAGER" || role === "ADMIN";

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Escape closes, and focus moves into the panel on open / back to the
  // hamburger on close — without this the keyboard is stranded behind the
  // overlay and screen-reader users lose their place.
  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [open]);

  return (
    <div className="md:hidden">
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-chrome-border bg-chrome/95 px-2 backdrop-blur-md">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ouvrir le menu"
          aria-expanded={open}
          aria-controls="menu-mobile"
          className="grid size-11 place-items-center rounded-xl text-chrome-dim transition-colors active:bg-chrome-hover"
        >
          <Menu className="size-5" aria-hidden />
        </button>
        <span className="truncate font-semibold tracking-tight text-chrome-fg">
          {titleFor(pathname)}
        </span>
        <NotificationBell
          notifications={notifications}
          unreadCount={unreadCount}
          reminders={reminders}
          className="ml-auto"
        />
      </header>

      {/* Overlay */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden
        className={cn(
          "fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px] transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />

      {/* Drawer panel. `inert` while closed keeps its links out of the tab
          order instead of leaving invisible focus stops off-screen. */}
      <aside
        id="menu-mobile"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menu de navigation"
        inert={!open}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-chrome shadow-overlay transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between px-5">
          {company === "FAIRUP" ? (
            // White chip for the same reason as the desktop sidebar: the logo
            // artwork carries an opaque white background.
            <span className="grid h-8 place-items-center rounded-lg bg-white px-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/api/logo/fairup" alt="Fair'Up" className="h-5 w-auto object-contain" />
            </span>
          ) : (
            <span className="text-lg font-semibold tracking-tight text-chrome-fg">FAIR2UP</span>
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fermer le menu"
            className="grid size-11 place-items-center rounded-xl text-chrome-muted transition-colors active:bg-chrome-hover"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <nav aria-label="Navigation principale" className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
          {groups.map(({ section, items }) => (
            <div key={section} className="space-y-0.5">
              {groups.length > 1 && (
                <p className="nav-label px-3 pb-1.5 pt-1 text-chrome-muted">{SECTION_LABELS[section]}</p>
              )}
              {items.map((item) => (
                <NavLink key={item.href} item={item} count={counts[item.href]} onNavigate={() => setOpen(false)} />
              ))}
            </div>
          ))}
        </nav>

        <div className="border-t border-chrome-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mb-2 flex items-center gap-3 px-2 py-1.5">
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-white/10 text-sm font-semibold text-chrome-fg">
              {initials(name)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-chrome-fg">{name}</p>
              <p className="truncate text-xs text-chrome-muted">{ROLE_LABELS[role] ?? role}</p>
            </div>
          </div>
          {canSwitch && (
            <Link
              href="/select-company"
              onClick={() => setOpen(false)}
              className="mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-chrome-dim transition-colors active:bg-chrome-hover"
            >
              <Building2 className="size-5 shrink-0 text-chrome-muted" aria-hidden />
              <span>Changer d&apos;espace</span>
            </Link>
          )}
          <LogoutButton />
        </div>
      </aside>
    </div>
  );
}
