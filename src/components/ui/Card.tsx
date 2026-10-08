import { cn } from "@/lib/utils";

/**
 * The one surface primitive.
 *
 * The edge is a `ring` rather than a `border`: it draws on the outside of the
 * box so it never competes with the card's own padding, and a 7%-alpha slate
 * reads as a crisp hairline at any zoom where a solid slate-200 starts to
 * look grey and heavy.
 */
export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn(
        // overflow-hidden so a table's tinted header band and a list's first
        // divider are clipped by the corner radius instead of squaring it off.
        // Safe here: every overlay in the product renders through a portal.
        "overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-slate-900/[0.07] transition-[box-shadow,transform] duration-200 hover:-translate-y-px hover:shadow-card-hover",
        // OLED dark: a floating #121212 sheet lifted off the pure-black canvas
        // by a brighter hairline instead of a shadow (shadows vanish on black).
        "dark:bg-[#121212] dark:shadow-none dark:ring-white/10",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Card header — title on the left, optional actions/badges on the right. */
export function CardHeader({
  title,
  icon: Icon,
  action,
  className,
  children,
}: {
  title?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-100 px-5 py-4",
        "dark:border-white/10",
        className
      )}
    >
      {Icon && <Icon className="size-4 shrink-0 text-slate-400 dark:text-neutral-500" />}
      {title && (
        // 15px: a card title heading a whole table needs to outrank the 14px
        // body inside it, and 14px-on-14px was reading as just another row.
        <h2 className="text-[0.9375rem] font-semibold tracking-tight text-slate-900 dark:text-white">
          {title}
        </h2>
      )}
      {children}
      {action && <div className="ml-auto">{action}</div>}
    </div>
  );
}

const EYEBROW_TONES = {
  brand: "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-200",
  emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
  violet: "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
  slate: "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-neutral-300",
} as const;

/**
 * Label row of a stat card: a tinted icon chip plus a quiet caption. Replaces
 * the coloured top-border treatment — the tint now sits where the eye already
 * lands (next to the label) instead of on the card's edge.
 */
export function CardEyebrow({
  icon: Icon,
  tone = "slate",
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone?: keyof typeof EYEBROW_TONES;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-xl", EYEBROW_TONES[tone])}>
        <Icon className="size-4" />
      </span>
      <span className="truncate text-sm font-medium text-slate-500 dark:text-neutral-400">{children}</span>
    </div>
  );
}

export function CardBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("p-5 md:p-6", className)}>{children}</div>;
}
