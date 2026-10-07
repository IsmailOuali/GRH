/**
 * Shared control surface. The focus treatment (brand border + soft 3px ring)
 * is identical on every input, select and textarea in the product, so "where
 * am I typing?" never has to be re-learned from screen to screen.
 *
 * Plain module (no "use client") so server and client components can both
 * pull these strings in.
 */
export const controlClass =
  "w-full rounded-lg border border-slate-300/90 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-slate-400 hover:border-slate-400 " +
  "focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-600/15 " +
  "aria-[invalid=true]:border-red-500 aria-[invalid=true]:ring-4 aria-[invalid=true]:ring-red-500/10 " +
  "disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 disabled:shadow-none md:py-2";

/** Read-only mirror of a computed value (jours ouvrés, date de reprise…). */
export const readOnlyControlClass =
  "w-full cursor-default rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600 shadow-inner md:py-2";

export const labelClass = "block text-sm font-semibold text-slate-700";
