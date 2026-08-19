"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { primaryNavFor, type NavItem } from "@/lib/nav";
import { cn, isActiveRoute } from "@/lib/utils";

function TabIcon({ item, active }: { item: NavItem; active: boolean }) {
  const { pending } = useLinkStatus();
  const Icon = item.icon;
  if (pending) return <Loader2 className="size-5 animate-spin text-white" aria-hidden />;
  return <Icon className={cn("size-5 transition-colors", active ? "text-white" : "text-chrome-muted")} aria-hidden />;
}

/**
 * Thumb-reachable bottom navigation for the primary routes on mobile.
 * Hidden at md+. Pair with bottom padding on <main> so content clears it.
 */
export function BottomTabBar({ role, counts = {} }: { role: string; counts?: Record<string, number> }) {
  const pathname = usePathname();
  const items = primaryNavFor(role);

  return (
    <nav
      aria-label="Navigation rapide"
      className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-chrome-border bg-chrome/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      {items.map((item) => {
        const active = isActiveRoute(pathname, item.href);
        const count = counts[item.href] ?? 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            aria-current={active ? "page" : undefined}
            className="relative flex h-16 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors active:bg-chrome-hover"
          >
            {/* Top rule marks the active tab for anyone who misses the tint. */}
            <span
              aria-hidden
              className={cn(
                "absolute inset-x-4 top-0 h-0.5 rounded-full bg-white transition-opacity",
                active ? "opacity-100" : "opacity-0"
              )}
            />
            <span className="relative">
              <TabIcon item={item} active={active} />
              {count > 0 && (
                <span
                  aria-label={`${count} demande(s) en attente`}
                  className="absolute -right-2.5 -top-1.5 grid h-4 min-w-[1rem] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold tabular-nums text-white ring-2 ring-chrome"
                >
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </span>
            <span className={cn("truncate px-1 transition-colors", active ? "text-white" : "text-chrome-muted")}>
              {item.label.split(" ")[0]}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
