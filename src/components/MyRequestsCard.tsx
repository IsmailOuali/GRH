"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { CheckCircle2, ChevronRight, ClipboardList, MessageSquareReply } from "lucide-react";
import { Card, CardEyebrow } from "@/components/ui/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { cn } from "@/lib/utils";
import { markNotificationRead } from "@/app/(dashboard)/notifications/actions";
import type { MyRequests } from "@/lib/my-requests";

/** Pending requests shown at most; the rest is summarised as "+ N autres". */
const MAX_PENDING_SHOWN = 6;

/** A refusal reads differently from a validation. The wording comes from the notification itself. */
function isRefusal(message: string): boolean {
  return /refus/i.test(message);
}

/**
 * Dashboard "Mes demandes" card for a salarié: the answers they have not opened
 * yet (a click opens the request and removes the row), then everything still
 * waiting for the RH. Reviewers have their own "À traiter" card instead.
 */
export function MyRequestsCard({ requests }: { requests: MyRequests }) {
  const [, startTransition] = useTransition();
  // Rows opened in this session leave immediately, without waiting for the server.
  const [opened, setOpened] = useState<string[]>([]);

  const responses = requests.responses.filter((r) => !opened.includes(r.id));
  const pending = requests.pending;
  const shown = pending.slice(0, MAX_PENDING_SHOWN);
  const hidden = pending.length - shown.length;
  const empty = responses.length === 0 && pending.length === 0;

  function open(id: string) {
    setOpened((prev) => [...prev, id]);
    startTransition(() => {
      markNotificationRead(id);
    });
  }

  const total = responses.length + pending.length;

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 px-5 pt-5">
        <CardEyebrow icon={ClipboardList} tone="brand">
          Mes demandes
        </CardEyebrow>
        {total > 0 && (
          <span className="rounded-full bg-brand-600 px-2.5 py-0.5 text-xs font-bold tabular-nums text-white dark:bg-brand-500">
            {total}
          </span>
        )}
      </div>

      {empty ? (
        <p className="flex items-center gap-2 px-5 pb-5 pt-4 text-sm text-slate-500 dark:text-neutral-400">
          <CheckCircle2 className="size-4 shrink-0 text-emerald-500" aria-hidden />
          Aucune demande en cours
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100 dark:divide-white/10 dark:border-white/10">
          {/* Answers first: they are what the salarié is waiting to see. */}
          {responses.map((r) => (
            <li key={r.id}>
              <Link
                href={r.href}
                onClick={() => open(r.id)}
                className="press group flex items-start gap-3 bg-brand-50/50 px-5 py-3.5 transition-colors hover:bg-brand-50 dark:bg-white/[0.04] dark:hover:bg-white/[0.07]"
              >
                <span
                  className={cn(
                    "mt-0.5 grid size-8 shrink-0 place-items-center rounded-full",
                    isRefusal(r.message)
                      ? "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300"
                      : "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
                  )}
                >
                  <MessageSquareReply className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-900 dark:text-neutral-100">{r.message}</span>
                  <span className="block text-xs text-slate-500 dark:text-neutral-400">
                    Il y a {formatDistanceToNow(new Date(r.createdAt), { locale: fr })}
                  </span>
                </span>
                <ChevronRight
                  className="mt-1.5 size-4 shrink-0 text-slate-300 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-slate-500 dark:text-neutral-600"
                  aria-hidden
                />
              </Link>
            </li>
          ))}

          {shown.map((p) => (
            <li key={p.key}>
              <Link
                href={p.href}
                className="press group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50/70 dark:hover:bg-white/[0.04]"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900 dark:text-neutral-100">
                    {p.title}
                  </span>
                  <span className="block truncate text-xs text-slate-500 dark:text-neutral-400">
                    {p.kind} · envoyée il y a {formatDistanceToNow(new Date(p.createdAt), { locale: fr })}
                  </span>
                </span>
                <StatusBadge status={p.state} />
                <ChevronRight
                  className="size-4 shrink-0 text-slate-300 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-slate-500 dark:text-neutral-600"
                  aria-hidden
                />
              </Link>
            </li>
          ))}

          {hidden > 0 && (
            <li className="px-5 py-3 text-xs text-slate-500 dark:text-neutral-400">
              + {hidden} autre{hidden > 1 ? "s" : ""} demande{hidden > 1 ? "s" : ""} en attente
            </li>
          )}
        </ul>
      )}
    </Card>
  );
}
