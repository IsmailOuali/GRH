import { cn } from "@/lib/utils";

/**
 * Data-table shell shared by congés / paie / documents.
 *
 * Wrapping in a scroll container keeps a wide table from pushing the page
 * body sideways on small screens, and centralising the header treatment fixes
 * the contrast of column labels everywhere at once (slate-400 on white failed
 * WCAG AA; slate-500 with a heavier weight passes).
 */
export function Table({
  className,
  children,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table {...props} className={cn("w-full text-sm", className)}>
        {children}
      </table>
    </div>
  );
}

export function Thead({ children }: { children: React.ReactNode }) {
  return (
    // A faint tint separates the header band from the first data row more
    // calmly than a heavier rule would, and survives horizontal scrolling.
    <thead className="bg-slate-50/70">
      <tr className="border-b border-slate-200/70 text-left">{children}</tr>
    </thead>
  );
}

export function Th({
  className,
  children,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      {...props}
      className={cn("th-label whitespace-nowrap px-5 py-3", className)}
    >
      {children}
    </th>
  );
}

export function Tbody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-slate-100">{children}</tbody>;
}
