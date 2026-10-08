"use client";

import Link from "next/link";
import { Building2 } from "lucide-react";
import { navGroupsFor, SECTION_LABELS } from "@/lib/nav";
import { cn } from "@/lib/utils";
import type { NotificationItem, PendingReminder } from "@/lib/notifications";
import { NavLink } from "./NavLink";
import { LogoutButton } from "./LogoutButton";
import { NotificationBell } from "./NotificationBell";

const ROLE_LABELS: Record<string, string> = {
  EMPLOYEE: "Salarié",
  SUPERVISEUR: "Superviseur",
  MANAGER: "Responsable",
  ADMIN: "Directeur",
};

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

type SidebarProps = {
  role: string;
  name: string;
  company: string;
  counts?: Record<string, number>;
  notifications?: NotificationItem[];
  unreadCount?: number;
  reminders?: PendingReminder[];
  className?: string;
};

export function Sidebar({
  role,
  name,
  company,
  counts = {},
  notifications = [],
  unreadCount = 0,
  reminders = [],
  className,
}: SidebarProps) {
  const groups = navGroupsFor(role);
  const canSwitch = role === "MANAGER" || role === "ADMIN";

  return (
    <aside
      className={cn(
        "sticky top-0 flex h-screen w-[17rem] shrink-0 flex-col border-r border-chrome-border bg-chrome shadow-[8px_0_24px_-20px_rgb(0_0_0/0.35)]",
        className
      )}
    >
      {/* Company branding */}
      <div className="flex h-[4.5rem] items-center gap-2.5 border-b border-chrome-border px-5">
        {company === "FAIRUP" ? (
          // The logo artwork is dark navy on an opaque white background, so on
          // the navy chrome it needs its own white chip — otherwise it renders
          // as a bare white rectangle. Swap for a transparent/light-on-dark
          // variant and this wrapper can go.
          <span className="grid h-8 shrink-0 place-items-center rounded-lg bg-white px-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/api/logo/fairup" alt="Fair'Up" className="h-5 w-auto object-contain" />
          </span>
        ) : (
          <div className="grid size-8 place-items-center rounded-xl bg-white/10 text-xs font-black text-chrome-fg">
            F2
          </div>
        )}
        <span className="text-base font-semibold tracking-tight text-chrome-fg">
          {company === "FAIRUP" ? "Fair’Up OS" : "FAIR2UP"}
        </span>
        <NotificationBell
          notifications={notifications}
          unreadCount={unreadCount}
          reminders={reminders}
          className="ml-auto"
          align="left"
        />
      </div>

      {/* Grouped so admin tools stop competing with the daily routes. A single
          group renders unlabelled — an employee has nothing to disambiguate. */}
      <nav aria-label="Navigation principale" className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {groups.map(({ section, items }) => (
          <div key={section} className="space-y-0.5">
            {groups.length > 1 && (
              <p className="nav-label px-3 pb-1.5 pt-1 text-chrome-muted">{SECTION_LABELS[section]}</p>
            )}
            {items.map((item) => (
              <NavLink key={item.href} item={item} count={counts[item.href]} />
            ))}
          </div>
        ))}
      </nav>

      <div className="border-t border-chrome-border p-3">
        <div className="mb-2 flex items-center gap-3 rounded-xl px-2 py-1.5">
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
            className="mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-chrome-dim transition-colors hover:bg-chrome-hover hover:text-white"
          >
            <Building2 className="size-5 shrink-0 text-chrome-muted" aria-hidden />
            <span>Changer d&apos;espace</span>
          </Link>
        )}
        <LogoutButton />
      </div>
    </aside>
  );
}
