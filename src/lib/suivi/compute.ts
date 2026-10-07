/**
 * Suivi RH figures — the Excel workbook's formulas, ported.
 *
 * Everything here is pure: it takes tracked employees and returns numbers, so
 * the maths can be checked against the spreadsheet without a database.
 *
 * SCOPE NOTE: the "Salariés" sheet carries cumulative "à date" totals with no
 * underlying dated entries, so every figure below is a CUMULATIVE one. Monthly
 * figures, the 12-month trend and the justifié/non-justifié split need the
 * tracking journal and arrive with it.
 */

import { businessDaysInMonth } from "@/lib/dates";

export type TrackedEmployeeLike = {
  id: string;
  nomComplet: string;
  prenom: string;
  poste: string | null;
  dateEntree: string | null;
  dateSortie: string | null;
  soldeCongesN: number | null;
  repriseCongesPris: number;
  repriseAbsences: number;
  repriseRetardsNb: number;
  repriseRetardsH: number;
  userId?: string | null;
};

export type SuiviRow = {
  employee: TrackedEmployeeLike;
  absences: number;
  retardsNb: number;
  retardsH: number;
  congesPris: number;
  /** null when the sheet leaves "Solde congés N" blank. */
  solde: number | null;
  /** Fraction of the entitlement still available, 0–1. null when no entitlement. */
  soldeRatio: number | null;
  parti: boolean;
};

export type SuiviTotals = {
  rows: SuiviRow[];
  effectif: number;
  effectifTotal: number;
  absences: number;
  retardsNb: number;
  retardsH: number;
  congesPris: number;
  soldeRestant: number;
  tauxAbsenteisme: number;
};

/**
 * Jours ouvrés in a month, lundi–vendredi.
 *
 * NOTE: the source workbook counted Saturday as worked (août 2026 = 26 j).
 * FAIR2UP does not work Saturdays, so this deliberately diverges from the
 * sheet — the taux d'absentéisme computed here will not match the workbook's.
 * Delegates to the shared rule so it can never drift again.
 */
export function joursOuvresDuMois(year: number, month: number): number {
  return businessDaysInMonth(year, month);
}

export function computeSuivi(
  employees: TrackedEmployeeLike[],
  joursOuvres: number,
): SuiviTotals {
  const rows: SuiviRow[] = employees.map((e) => {
    const solde = e.soldeCongesN === null ? null : e.soldeCongesN - e.repriseCongesPris;
    return {
      employee: e,
      absences: e.repriseAbsences,
      retardsNb: e.repriseRetardsNb,
      retardsH: e.repriseRetardsH,
      congesPris: e.repriseCongesPris,
      solde,
      soldeRatio:
        solde === null || !e.soldeCongesN ? null : Math.max(0, Math.min(1, solde / e.soldeCongesN)),
      parti: Boolean(e.dateSortie),
    };
  });

  const actifs = rows.filter((r) => !r.parti);
  const sum = (pick: (r: SuiviRow) => number) => rows.reduce((s, r) => s + pick(r), 0);

  const absences = sum((r) => r.absences);
  // Absenteeism is measured against the people actually present: counting
  // leavers in the denominator would quietly deflate the rate every time
  // someone is marked as parti.
  const effectif = actifs.length;

  return {
    rows,
    effectif,
    effectifTotal: rows.length,
    absences,
    retardsNb: sum((r) => r.retardsNb),
    retardsH: sum((r) => r.retardsH),
    congesPris: sum((r) => r.congesPris),
    soldeRestant: sum((r) => r.solde ?? 0),
    tauxAbsenteisme: effectif && joursOuvres ? absences / (effectif * joursOuvres) : 0,
  };
}

export type SuiviAlert = { level: "crit" | "warn"; text: string };

/** Thresholds carried over from the workbook's conditional formatting. */
export const SEUIL_ABSENTEISME = 0.05;
export const SEUIL_SOLDE_FAIBLE = 2;
export const SEUIL_RETARDS = 3;

export function computeAlerts(t: SuiviTotals): SuiviAlert[] {
  const alerts: SuiviAlert[] = [];

  if (t.tauxAbsenteisme > SEUIL_ABSENTEISME) {
    alerts.push({
      level: "crit",
      text: `Taux d'absentéisme élevé (${formatPct(t.tauxAbsenteisme)})`,
    });
  }

  for (const r of t.rows) {
    if (r.parti) continue; // a leaver's low balance is not an action for anyone
    if (r.solde !== null && r.solde < SEUIL_SOLDE_FAIBLE) {
      alerts.push({
        level: "warn",
        text: `${r.employee.nomComplet} — solde congés faible (${formatDays(r.solde)})`,
      });
    }
    if (r.retardsNb >= SEUIL_RETARDS) {
      alerts.push({
        level: "warn",
        text: `${r.employee.nomComplet} — retards récurrents (${r.retardsNb})`,
      });
    }
  }

  // Criticals first so the most urgent chip is never pushed off the first row.
  return alerts.sort((a, b) => (a.level === b.level ? 0 : a.level === "crit" ? -1 : 1));
}

export function formatPct(x: number): string {
  return (x * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " %";
}

export function formatNum(x: number | null, max = 1): string {
  if (x === null || x === undefined) return "—";
  return x.toLocaleString("fr-FR", { maximumFractionDigits: max });
}

export function formatDays(x: number | null): string {
  if (x === null) return "—";
  return `${formatNum(x)} j`;
}

export function initials(nomComplet: string): string {
  return nomComplet
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
