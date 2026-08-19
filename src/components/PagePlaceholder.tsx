import { type LucideIcon } from "lucide-react";

/**
 * Placeholder page body for the skeleton. Replace each route's page.tsx with the
 * real feature (forms, tables, server fetches) per REBUILD_PRODUCT.md.
 */
export function PagePlaceholder({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <div className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-600">
          <Icon className="size-6" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-3 h-3 w-24 rounded bg-slate-100" />
            <div className="mb-2 h-6 w-32 rounded bg-slate-100" />
            <div className="h-3 w-full rounded bg-slate-50" />
          </div>
        ))}
      </div>

      <p className="mt-8 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-400">
        Écran de démonstration — la navigation est fonctionnelle. Le contenu réel
        sera branché ici.
      </p>
    </div>
  );
}
