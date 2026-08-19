"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn, isActiveRoute } from "@/lib/utils";
import type { NavItem } from "@/lib/nav";

/**
 * Shows a spinner on the link the *instant* it is clicked — before the server
 * responds — using Next 16's useLinkStatus(). Must be rendered as a child of
 * <Link>. This is the core of the "instant nav feel": click → immediate feedback.
 */
function PendingIndicator() {
  const { pending } = useLinkStatus();
  return pending ? (
    <Loader2 className="size-4 shrink-0 animate-spin opacity-70" aria-hidden />
  ) : null;
}

type NavLinkProps = {
  item: NavItem;
  /** Number of pending demandes for this route — renders a badge when > 0. */
  count?: number;
  /** Called after navigation starts — used to close the mobile drawer. */
  onNavigate?: () => void;
};

export function NavLink({ item, count = 0, onNavigate }: NavLinkProps) {
  const pathname = usePathname();
  const active = item.exact ? pathname === item.href : isActiveRoute(pathname, item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      prefetch
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        // Rendered only inside the dark nav chrome (Sidebar + mobile drawer),
        // so the states are tints of white rather than of the brand ramp —
        // a navy accent on a navy surface would be invisible.
        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors md:py-2",
        active
          ? "bg-chrome-active text-white"
          : "text-chrome-dim hover:bg-chrome-hover hover:text-white"
      )}
    >
      {/* Redundant-by-design position cue for anyone who can't rely on the tint. */}
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-white transition-opacity",
          active ? "opacity-100" : "opacity-0"
        )}
      />
      <Icon
        className={cn(
          "size-5 shrink-0 transition-colors",
          active ? "text-white" : "text-chrome-muted group-hover:text-chrome-dim"
        )}
        aria-hidden
      />
      <span className="truncate">{item.label}</span>
      <span className="ml-auto flex items-center gap-2">
        {count > 0 && (
          <span
            aria-label={`${count} demande(s) en attente`}
            className={cn(
              "grid h-5 min-w-[1.25rem] place-items-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
              // rose-500 is bright enough to carry white text on navy; the
              // active variant goes solid white-on-navy so it reads as "here".
              active ? "bg-white text-chrome" : "bg-rose-500 text-white"
            )}
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
        <PendingIndicator />
      </span>
    </Link>
  );
}
