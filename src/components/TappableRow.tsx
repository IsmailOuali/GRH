"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { MobileDetailModal, type DetailItem } from "./MobileDetailModal";

/**
 * A table row that, ON MOBILE ONLY, opens a detail popup when tapped anywhere
 * except on an interactive control (so inline buttons/links keep working).
 * On desktop it behaves like a normal <tr>.
 *
 * Renders an extra chevron cell on mobile as a tap affordance — pair it with
 * `hidden md:table-cell` on the table's secondary columns so the visible
 * mobile columns stay readable.
 */
export function TappableRow({
  detail,
  children,
  className = "",
}: {
  detail: { title: string; items: DetailItem[]; actions?: React.ReactNode };
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  function handleClick(e: React.MouseEvent) {
    // Desktop: do nothing — the table is already readable.
    if (typeof window !== "undefined" && !window.matchMedia("(max-width: 767px)").matches) return;
    // Let taps on real controls behave normally.
    if ((e.target as HTMLElement).closest("button, a, input, select, textarea, label")) return;
    setOpen(true);
  }

  return (
    <>
      <tr
        onClick={handleClick}
        className={`cursor-pointer transition-colors duration-100 active:bg-slate-100 md:cursor-default md:active:bg-transparent ${className}`}
      >
        {children}
        <td className="w-8 pr-3 text-right md:hidden" aria-hidden>
          <ChevronRight className="ml-auto size-4 text-slate-300" />
        </td>
      </tr>
      <MobileDetailModal
        open={open}
        onClose={() => setOpen(false)}
        title={detail.title}
        items={detail.items}
        actions={detail.actions}
      />
    </>
  );
}
