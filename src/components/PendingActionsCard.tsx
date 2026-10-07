import Link from "next/link";
import { differenceInDays, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FilePlus2,
  FileText,
  Laptop,
  type LucideIcon,
} from "lucide-react";
import { Card, CardEyebrow } from "@/components/ui/Card";
import type { PendingSummaryItem } from "@/lib/notifications";
import { cn } from "@/lib/utils";

const ICONS: Record<PendingSummaryItem["key"], LucideIcon> = {
  conges: CalendarDays,
  documents: FilePlus2,
  paie: FileText,
  teletravail: Laptop,
};

/** A request waiting this long or more gets flagged in amber. */
const STALE_AFTER_DAYS = 3;

/**
 * Dashboard "À traiter" card for reviewers: one row per kind of request that
 * is waiting on them, each linking to the page where it is actioned. Empty
 * categories are omitted; when nothing is left the card says so rather than
 * vanishing, so a manager can tell "all done" from "widget missing".
 */
export function PendingActionsCard({ items }: { items: PendingSummaryItem[] }) {
  const total = items.reduce((sum, item) => sum + item.count, 0);

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 px-5 pt-5">
        <CardEyebrow icon={ClipboardCheck} tone="brand">
          À traiter
        </CardEyebrow>
        {total > 0 && (
          <span className="rounded-full bg-brand-600 px-2.5 py-0.5 text-xs font-bold tabular-nums text-white dark:bg-brand-500">
            {total}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <p className="flex items-center gap-2 px-5 pb-5 pt-4 text-sm text-slate-500 dark:text-neutral-400">
          <CheckCircle2 className="size-4 shrink-0 text-emerald-500" aria-hidden />
          Tout est à jour
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100 dark:divide-white/10 dark:border-white/10">
          {items.map((item) => {
            const Icon = ICONS[item.key];
            const stale = differenceInDays(new Date(), item.oldest) >= STALE_AFTER_DAYS;
            return (
              <li key={item.key}>
                {/* press: thumb-scale on tap · hover tints the whole row ·
                    chevron slides 2px toward its target on hover */}
                <Link
                  href={item.href}
                  className="press group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50/70 dark:hover:bg-white/[0.04]"
                >
                  <span
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-full transition-colors",
                      stale
                        ? "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300"
                        : "bg-slate-100 text-slate-500 group-hover:bg-slate-200/70 dark:bg-white/10 dark:text-neutral-300",
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900 dark:text-neutral-100">
                      {item.label}
                    </span>
                    <span
                      className={cn(
                        "block truncate text-xs",
                        stale
                          ? "font-medium text-amber-600 dark:text-amber-400"
                          : "text-slate-500 dark:text-neutral-400",
                      )}
                    >
                      La plus ancienne : il y a {formatDistanceToNow(item.oldest, { locale: fr })}
                    </span>
                  </span>
                  <span className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">
                    {item.count}
                  </span>
                  <ChevronRight
                    className="size-4 shrink-0 text-slate-300 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-slate-500 dark:text-neutral-600 dark:group-hover:text-neutral-400"
                    aria-hidden
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
