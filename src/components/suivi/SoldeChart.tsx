"use client";

import { useState } from "react";
import type { SuiviRow } from "@/lib/suivi/compute";
import { formatNum, initials, SEUIL_SOLDE_FAIBLE } from "@/lib/suivi/compute";

/**
 * Congés: entitlement split into "pris" and "restant", one bar per salarié.
 *
 * Sequential rather than categorical colour — both segments measure the same
 * thing (jours de congé) in two states, so they are two steps of the brand
 * ramp, not two hues. The light step sits at 2.6:1 on white, below the 3:1
 * bar, so every segment carries a direct value label and the same figures are
 * repeated in the Suivi RH table: the two reliefs that licence it.
 *
 * Bars share one x-scale in days instead of each being normalised to its own
 * 100%. That costs a little contrast on small entitlements but makes "1,5 j
 * total" and "14 j total" visibly different quantities, which per-row gauges
 * hide entirely.
 */

const RESTANT = "#2f4d84"; // brand-500
const PRIS = "#8aa0c9"; // brand-300

const ROW_H = 26;
const BAR_H = 13;
const GUTTER = 168; // name column
const RIGHT = 74; // value label column
const TOP = 30;
const VB_W = 760;

export function SoldeChart({ rows }: { rows: SuiviRow[] }) {
  const [hover, setHover] = useState<{ x: number; y: number; row: SuiviRow } | null>(null);

  // Only people with a declared entitlement can be plotted; the rest are
  // reported below the chart rather than drawn as zero-length bars.
  const plotted = rows.filter((r) => r.employee.soldeCongesN && r.solde !== null);
  const sansSolde = rows.filter((r) => !r.employee.soldeCongesN || r.solde === null);

  // Fewest days remaining first, NOT lowest ratio: the "solde faible" alert
  // fires on absolute days, so ordering by ratio scatters the very people the
  // chart exists to surface (1,5 / 1,5 j is 100% consumed-nothing, yet it is
  // the most urgent row on the page).
  const sorted = [...plotted].sort((a, b) => (a.solde ?? 0) - (b.solde ?? 0));

  const max = Math.max(...plotted.map((r) => r.employee.soldeCongesN ?? 0), 1);
  const plotW = VB_W - GUTTER - RIGHT;
  const height = TOP + sorted.length * ROW_H + 26;
  const scale = (v: number) => (v / max) * plotW;

  // Axis at "nice" day intervals rather than an arbitrary division.
  const step = max <= 6 ? 2 : max <= 16 ? 4 : 5;
  const ticks: number[] = [];
  for (let t = 0; t <= max; t += step) ticks.push(t);

  if (plotted.length === 0) {
    return (
      <p className="px-1 py-8 text-center text-sm text-slate-500">
        Aucun solde de congés renseigné — importez le fichier « Salariés » pour alimenter ce graphique.
      </p>
    );
  }

  return (
    <div className="relative">
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: RESTANT }} aria-hidden />
          Solde restant
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: PRIS }} aria-hidden />
          Congés pris
        </span>
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${VB_W} ${height}`}
          className="w-full min-w-[560px]"
          role="img"
          aria-label={`Solde de congés par salarié, ${sorted.length} salariés`}
        >
          {/* Recessive grid: ticks behind the marks, never competing with them. */}
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={GUTTER + scale(t)} y1={TOP - 8}
                x2={GUTTER + scale(t)} y2={height - 24}
                stroke="#e2e8f0" strokeWidth="1"
              />
              <text
                x={GUTTER + scale(t)} y={height - 8}
                textAnchor="middle" fontSize="10" fill="#64748b"
              >
                {t} j
              </text>
            </g>
          ))}

          {sorted.map((r, i) => {
            const y = TOP + i * ROW_H;
            const total = r.employee.soldeCongesN ?? 0;
            const restant = r.solde ?? 0;
            const pris = Math.max(0, total - restant);
            const wRestant = scale(restant);
            const wPris = scale(pris);
            const faible = restant < SEUIL_SOLDE_FAIBLE;

            return (
              <g
                key={r.employee.id}
                onMouseEnter={() => setHover({ x: GUTTER + scale(total), y, row: r })}
                onMouseLeave={() => setHover(null)}
              >
                {/* Hit target spanning the row, larger than the 13px bar. */}
                <rect x="0" y={y - 4} width={VB_W} height={ROW_H} fill="transparent" />

                <text x="0" y={y + BAR_H - 2} fontSize="11.5" fill="#334155">
                  {r.employee.nomComplet.length > 24
                    ? r.employee.nomComplet.slice(0, 23) + "…"
                    : r.employee.nomComplet}
                </text>

                {/* Restant, anchored to the baseline with rounded outer end. */}
                {wRestant > 0 && (
                  <rect
                    x={GUTTER} y={y} width={Math.max(wRestant, 2)} height={BAR_H}
                    rx="3" fill={RESTANT}
                  />
                )}
                {/* Pris, offset by a 2px surface gap so the split is legible
                    even where one segment is very short. */}
                {wPris > 0 && (
                  <rect
                    x={GUTTER + wRestant + 2} y={y} width={Math.max(wPris - 2, 2)} height={BAR_H}
                    rx="3" fill={PRIS}
                  />
                )}

                <text
                  x={GUTTER + scale(total) + 8} y={y + BAR_H - 2}
                  fontSize="11" fill={faible ? "#e11d48" : "#475569"}
                  fontWeight={faible ? 600 : 400}
                >
                  {formatNum(restant)} / {formatNum(total)} j
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {hover && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg"
          style={{
            left: `${((hover.x + 12) / VB_W) * 100}%`,
            top: `${((hover.y / (TOP + sorted.length * ROW_H + 26)) * 100)}%`,
          }}
        >
          <p className="font-semibold">{hover.row.employee.nomComplet}</p>
          <p className="mt-0.5 text-slate-300">
            {formatNum(hover.row.solde)} j restants sur {formatNum(hover.row.employee.soldeCongesN)} j
          </p>
          <p className="text-slate-300">{formatNum(hover.row.congesPris)} j pris</p>
        </div>
      )}

      {/* Identity is never colour-alone: the at-risk state is stated in words. */}
      <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5 font-medium text-rose-600">
          <span className="size-1.5 rounded-full bg-rose-600" aria-hidden />
          Solde faible
        </span>
        = moins de {SEUIL_SOLDE_FAIBLE} jours restants.
        {sansSolde.length > 0 && (
          <span>
            · {sansSolde.length} salarié(s) sans solde renseigné :{" "}
            {sansSolde.map((r) => r.employee.nomComplet).join(", ")}.
          </span>
        )}
      </p>
    </div>
  );
}

export function SoldeAvatar({ nomComplet }: { nomComplet: string }) {
  return (
    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-50 text-[10px] font-bold text-brand-700">
      {initials(nomComplet)}
    </span>
  );
}
