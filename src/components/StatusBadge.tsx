import { cn } from "@/lib/utils";

/**
 * Status is carried by three redundant signals — dot colour, fill and the
 * French label — so it never depends on hue alone. Text tones are the 800
 * step on a 50 fill, which clears WCAG AA at this size.
 */
const STYLES: Record<string, { chip: string; dot: string }> = {
  PENDING:     { chip: "bg-amber-50 text-amber-800 ring-amber-200",       dot: "bg-amber-500" },
  IN_PROGRESS: { chip: "bg-amber-50 text-amber-800 ring-amber-200",       dot: "bg-amber-500" },
  APPROVED:    { chip: "bg-emerald-50 text-emerald-800 ring-emerald-200", dot: "bg-emerald-500" },
  RESOLVED:    { chip: "bg-emerald-50 text-emerald-800 ring-emerald-200", dot: "bg-emerald-500" },
  CLOSED:      { chip: "bg-emerald-50 text-emerald-800 ring-emerald-200", dot: "bg-emerald-500" },
  REJECTED:    { chip: "bg-red-50 text-red-800 ring-red-200",             dot: "bg-red-500" },
  OPEN:        { chip: "bg-blue-50 text-blue-800 ring-blue-200",          dot: "bg-blue-500" },
};

const FALLBACK = { chip: "bg-slate-100 text-slate-700 ring-slate-200", dot: "bg-slate-400" };

const LABELS: Record<string, string> = {
  PENDING:     "En attente",
  IN_PROGRESS: "En cours",
  APPROVED:    "Approuvé",
  RESOLVED:    "Résolu",
  CLOSED:      "Résolu",
  REJECTED:    "Refusé",
  OPEN:        "Ouvert",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const style = STYLES[status] ?? FALLBACK;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        style.chip
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", style.dot)} aria-hidden />
      {label ?? LABELS[status] ?? status}
    </span>
  );
}
