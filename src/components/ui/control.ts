/**
 * Shared control surface. The focus treatment (brand border + soft 3px ring)
 * is identical on every input, select and textarea in the product, so "where
 * am I typing?" never has to be re-learned from screen to screen.
 *
 * Plain module (no "use client") so server and client components can both
 * pull these strings in.
 */
export const controlClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-[0_1px_1px_rgb(15_23_42/0.03)] transition-[border-color,box-shadow] placeholder:text-slate-400 " +
  "focus:border-brand-500 focus:outline-none focus:ring-[3px] focus:ring-brand-500/20 " +
  "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 md:py-2";

/** Read-only mirror of a computed value (jours ouvrés, date de reprise…). */
export const readOnlyControlClass =
  "w-full cursor-default rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600 md:py-2";

export const labelClass = "block text-sm font-medium text-slate-700";
