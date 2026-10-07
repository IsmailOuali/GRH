"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { controlClass, labelClass } from "@/components/ui/control";
import { updateTrackedEmployee } from "@/app/(dashboard)/conges/suivi-actions";

type Employee = {
  id: string;
  nomComplet: string;
  poste: string | null;
  dateEntree: string | null;
  dateSortie: string | null;
  soldeCongesN: number | null;
  repriseCongesPris: number;
  repriseAbsences: number;
  repriseRetardsNb: number;
  repriseRetardsH: number;
};

type FormState = {
  poste: string;
  dateEntree: string;
  dateSortie: string;
  soldeCongesN: string;
  congesPris: string;
  absences: string;
  retardsNb: string;
  retardsH: string;
};

const str = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));

function toForm(e: Employee): FormState {
  return {
    poste: e.poste ?? "",
    dateEntree: e.dateEntree ?? "",
    dateSortie: e.dateSortie ?? "",
    soldeCongesN: str(e.soldeCongesN),
    congesPris: str(e.repriseCongesPris),
    absences: str(e.repriseAbsences),
    retardsNb: str(e.repriseRetardsNb),
    retardsH: str(e.repriseRetardsH),
  };
}

const NUM_FIELDS: { key: keyof FormState; label: string; hint?: string }[] = [
  { key: "soldeCongesN", label: "Solde congés N (j)", hint: "Droit annuel. Solde = N − congés pris" },
  { key: "congesPris", label: "Congés pris (j)" },
  { key: "absences", label: "Absences (j)" },
  { key: "retardsNb", label: "Retards (nb)" },
  { key: "retardsH", label: "Retards (h)" },
];

/**
 * "Modifier" button + modal for one row of the Suivi RH table, so a manager can
 * correct any field without re-importing the whole CSV.
 */
export function TrackedEmployeeEditor({ employee }: { employee: Employee }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => toForm(employee));

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, saving]);

  function launch() {
    setForm(toForm(employee));
    setError(null);
    setOpen(true);
  }

  function set(key: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await updateTrackedEmployee(employee.id, form);
    setSaving(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={launch}
        title={`Modifier ${employee.nomComplet}`}
        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 transition-colors hover:bg-slate-50 active:scale-95"
      >
        <Pencil className="size-3.5" aria-hidden />
        <span className="sr-only md:not-sr-only">Modifier</span>
      </button>

      {open && mounted &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Modifier ${employee.nomComplet}`}
            className="fixed inset-0 z-50 flex animate-fade-in items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4"
            onClick={() => !saving && setOpen(false)}
          >
            <div
              className="w-full max-w-lg overflow-hidden rounded-t-3xl bg-white shadow-overlay sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-slate-900">{employee.nomComplet}</h2>
                  <p className="text-xs text-slate-500">Modifier la fiche de suivi</p>
                </div>
                <button
                  type="button"
                  onClick={() => !saving && setOpen(false)}
                  aria-label="Fermer"
                  className="grid size-9 place-items-center rounded-full text-slate-500 hover:bg-slate-100"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>

              <form onSubmit={save} className="max-h-[70vh] space-y-4 overflow-y-auto p-5">
                <div>
                  <label className={labelClass} htmlFor={`poste-${employee.id}`}>Poste</label>
                  <input
                    id={`poste-${employee.id}`}
                    className={`${controlClass} mt-1.5`}
                    value={form.poste}
                    onChange={(e) => set("poste", e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass} htmlFor={`entree-${employee.id}`}>Date d&apos;entrée</label>
                    <input
                      id={`entree-${employee.id}`}
                      type="date"
                      className={`${controlClass} mt-1.5`}
                      value={form.dateEntree}
                      onChange={(e) => set("dateEntree", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor={`sortie-${employee.id}`}>Date de sortie</label>
                    <input
                      id={`sortie-${employee.id}`}
                      type="date"
                      className={`${controlClass} mt-1.5`}
                      value={form.dateSortie}
                      onChange={(e) => set("dateSortie", e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {NUM_FIELDS.map((f) => (
                    <div key={f.key}>
                      <label className={labelClass} htmlFor={`${f.key}-${employee.id}`}>{f.label}</label>
                      <input
                        id={`${f.key}-${employee.id}`}
                        inputMode="decimal"
                        className={`${controlClass} mt-1.5 tabular-nums`}
                        value={form[f.key]}
                        onChange={(e) => set(f.key, e.target.value)}
                        placeholder="0"
                      />
                      {f.hint && <p className="mt-1 text-xs text-slate-400">{f.hint}</p>}
                    </div>
                  ))}
                </div>

                {error && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
                    Annuler
                  </Button>
                  <Button type="submit" loading={saving}>
                    Enregistrer
                  </Button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
