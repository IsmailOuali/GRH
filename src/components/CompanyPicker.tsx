"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { selectCompanyAction } from "@/app/select-company/actions";
import type { CompanyInfo } from "@/lib/company";

const ACCENTS = [
  { accent: "border-t-indigo-500", btn: "bg-indigo-600 hover:bg-indigo-700", text: "text-indigo-600" },
  { accent: "border-t-violet-500", btn: "bg-violet-600 hover:bg-violet-700", text: "text-violet-600" },
  { accent: "border-t-emerald-500", btn: "bg-emerald-600 hover:bg-emerald-700", text: "text-emerald-600" },
  { accent: "border-t-amber-500", btn: "bg-amber-600 hover:bg-amber-700", text: "text-amber-600" },
  { accent: "border-t-rose-500", btn: "bg-rose-600 hover:bg-rose-700", text: "text-rose-600" },
  { accent: "border-t-cyan-500", btn: "bg-cyan-600 hover:bg-cyan-700", text: "text-cyan-600" },
];

function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.trim().slice(0, 2).toUpperCase();
}

function CompanyCard({ company, active, theme, demands }: { company: CompanyInfo; active: boolean; theme: (typeof ACCENTS)[0]; demands: number }) {
  const [pending, startTransition] = useTransition();
  const hasLogo = !!company.logoPath || company.code === "FAIRUP";

  function handleClick() {
    const fd = new FormData();
    fd.set("company", company.code);
    startTransition(() => selectCompanyAction(fd));
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className={`group relative flex w-full flex-col items-center rounded-2xl border-t-4 bg-white p-8 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg disabled:opacity-60 ${theme.accent} ${active ? "ring-2 ring-indigo-400 ring-offset-2" : "border border-slate-200"}`}
    >
      {demands > 0 && (
        <span
          title={`${demands} demande(s) en attente`}
          className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm"
        >
          {demands} en attente
        </span>
      )}
      <div className="mb-5 flex size-20 items-center justify-center overflow-hidden rounded-2xl bg-slate-50 shadow-inner">
        {hasLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/companies/${company.code}/logo`}
            alt={company.name}
            className="h-full w-full object-contain p-2"
          />
        ) : (
          <span className={`text-3xl font-black tracking-tighter ${theme.text}`}>{initials(company.name)}</span>
        )}
      </div>

      <p className="text-xl font-bold text-slate-900">{company.name}</p>
      {company.tagline && <p className="mt-1 text-sm text-slate-500">{company.tagline}</p>}

      <div className={`mt-6 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white transition-colors ${theme.btn}`}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : "Accéder →"}
      </div>
    </button>
  );
}

export function CompanyPicker({
  companies,
  current,
  demands = {},
}: {
  companies: CompanyInfo[];
  current?: string;
  demands?: Record<string, number>;
}) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {companies.map((company, i) => (
        <CompanyCard
          key={company.code}
          company={company}
          active={company.code === current}
          theme={ACCENTS[i % ACCENTS.length]}
          demands={demands[company.code] ?? 0}
        />
      ))}
    </div>
  );
}
