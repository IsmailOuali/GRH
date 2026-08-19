"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { markAllNotificationsRead, markNotificationRead } from "@/app/(dashboard)/notifications/actions";
import type { NotificationItem, PendingReminder } from "@/lib/notifications";

type NotificationBellProps = {
  notifications: NotificationItem[];
  unreadCount: number;
  reminders?: PendingReminder[];
  className?: string;
  /**
   * Which side the dropdown hangs from. "right" (default) suits the mobile
   * top bar, where the bell sits at the screen's right edge. The desktop
   * sidebar is narrower than the panel itself, so it needs "left" there —
   * otherwise the panel overflows off the left edge of the viewport.
   */
  align?: "left" | "right";
};

export function NotificationBell({
  notifications,
  unreadCount,
  reminders = [],
  className,
  align = "right",
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(notifications);
  const [unread, setUnread] = useState(unreadCount);
  const [, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);

  // Keep local state in sync when the server re-renders with fresh data
  // (e.g. after navigating to a page that revalidates a request).
  useEffect(() => {
    setItems(notifications);
    setUnread(unreadCount);
  }, [notifications, unreadCount]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function handleItemClick(id: string, read: boolean) {
    setOpen(false);
    if (read) return;
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnread((n) => Math.max(0, n - 1));
    startTransition(() => {
      markNotificationRead(id);
    });
  }

  function handleMarkAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
    startTransition(() => {
      markAllNotificationsRead();
    });
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="true"
        // The trigger always sits on the dark nav chrome (sidebar header or
        // mobile top bar); the dropdown below it is a white panel and keeps
        // its light styling.
        className="relative grid size-10 shrink-0 place-items-center rounded-xl text-chrome-dim transition-colors hover:bg-chrome-hover hover:text-white"
      >
        <Bell className="size-5" aria-hidden />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 grid min-w-[1.1rem] place-items-center rounded-full bg-red-600 px-1 text-[0.65rem] font-semibold leading-tight text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className={cn(
            "absolute top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200/70 bg-white shadow-overlay",
            align === "left" ? "left-0" : "right-0"
          )}
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Notifications</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                Tout marquer comme lu
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            <div className="py-1">
              {items.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-slate-500">Aucune notification</p>
              ) : (
                items.map((n) => (
                  <Link
                    key={n.id}
                    href={n.link ?? "#"}
                    onClick={() => handleItemClick(n.id, n.read)}
                    className={cn(
                      "block px-4 py-2.5 text-sm transition-colors hover:bg-slate-50",
                      !n.read && "bg-brand-50/60"
                    )}
                  >
                    <span className="flex items-start gap-2">
                      {!n.read && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-600" aria-hidden />}
                      <span className={cn("text-slate-700", !n.read && "font-medium text-slate-900")}>
                        {n.message}
                      </span>
                    </span>
                  </Link>
                ))
              )}
            </div>

            {reminders.length > 0 && (
              <div className="border-t border-slate-100 py-1">
                <p className="nav-label px-4 pb-1 pt-2 text-slate-500">En attente</p>
                {reminders.map((r) => (
                  <Link
                    key={r.id}
                    href={r.link}
                    onClick={() => setOpen(false)}
                    className="block px-4 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50"
                  >
                    {r.label} <span className="text-slate-400">· {r.age}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
