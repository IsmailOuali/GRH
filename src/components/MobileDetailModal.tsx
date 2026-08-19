"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export type DetailItem = { label: string; value: React.ReactNode };

/**
 * Mobile-only bottom-sheet that shows a table row's fields as a readable list.
 * Rendered via a portal so it can live inside a <tbody> without invalid nesting,
 * and `md:hidden` guarantees it never appears on desktop.
 */
export function MobileDetailModal({
  open,
  onClose,
  title,
  items,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  items: DetailItem[];
  /** Optional action buttons (validate/reject, …) shown above the close button. */
  actions?: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Callers pass an inline arrow for onClose; holding it in a ref keeps the
  // effect below keyed on `open` alone instead of re-running every render.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    // Escape dismisses the sheet — the same reflex as the overlay tap.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 md:hidden">
      <div className="absolute inset-0 animate-fade-in bg-slate-900/50" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 max-h-[85vh] animate-sheet-up overflow-y-auto overscroll-contain rounded-t-2xl bg-white shadow-overlay">
        <div className="sticky top-0 z-10 bg-white">
          <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-slate-300" />
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <h3 className="font-semibold text-slate-800">{title}</h3>
            <button
              onClick={onClose}
              aria-label="Fermer"
              className="-mr-1.5 grid size-10 place-items-center rounded-xl text-slate-400 active:bg-slate-100"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
        </div>

        <dl className="px-5 py-1">
          {items.map((it, i) => (
            <div
              key={i}
              className="flex items-start justify-between gap-4 border-b border-slate-50 py-3 last:border-0"
            >
              <dt className="shrink-0 text-sm text-slate-500">{it.label}</dt>
              <dd className="text-right text-sm font-medium text-slate-800">
                {it.value === "" || it.value == null ? <span className="text-slate-300">—</span> : it.value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="space-y-3 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
          {actions && <div className="border-t border-slate-100 pt-3">{actions}</div>}
          <button
            onClick={onClose}
            className="min-h-11 w-full rounded-xl bg-slate-100 text-sm font-medium text-slate-700 active:bg-slate-200"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
