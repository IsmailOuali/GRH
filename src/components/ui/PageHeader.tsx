import { cn } from "@/lib/utils";

/**
 * Consistent page masthead. The `<h1>` is always rendered for screen readers
 * and for the document outline; on mobile it is visually hidden instead of
 * removed, because the sticky top bar already shows the same title and
 * repeating it would waste the smallest viewport's most valuable rows.
 */
export function PageHeader({
  title,
  description,
  action,
  /** Keep the title visible on mobile (pages without a top-bar title). */
  alwaysShowTitle = false,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  alwaysShowTitle?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-7 flex flex-wrap items-end justify-between gap-x-4 gap-y-4 md:mb-9",
        className
      )}
    >
      <div className="min-w-0">
        <h1
          className={cn(
            "text-xl font-semibold tracking-tight text-slate-900 md:text-2xl",
            !alwaysShowTitle && "sr-only md:not-sr-only"
          )}
        >
          {title}
        </h1>
        {description && (
          <div className="text-sm text-slate-500 md:mt-1">{description}</div>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
