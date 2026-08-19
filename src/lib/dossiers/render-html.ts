/**
 * Builds the regeneration HTML for a Dossier Salarié, mirroring the source PDF's
 * five sections and French labels. Output is fed to the existing Puppeteer
 * wrapper (generatePdf). All values are HTML-escaped — no injection risk even if
 * an extracted field contains markup.
 */

import {
  SECTIONS,
  SCALAR_FIELDS_BY_SECTION,
  TYPE_CONTRAT_OPTIONS,
  STATUT_ESSAI_OPTIONS,
  OUTILS_LABEL,
  type DossierData,
  type SelectOption,
} from "./schema";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** yyyy-mm-dd → dd/mm/yyyy for display; pass through anything else. */
function formatDate(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : value;
}

function optionLabel(options: SelectOption[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

const EMPTY = '<span class="muted">—</span>';

function cell(value: string): string {
  const v = value.trim();
  return v ? escapeHtml(v) : EMPTY;
}

export function renderDossierHtml(data: DossierData, generatedAt: Date = new Date()): string {
  const rowsFor = (sectionId: string) =>
    (SCALAR_FIELDS_BY_SECTION[sectionId as keyof typeof SCALAR_FIELDS_BY_SECTION] ?? [])
      .map((f) => {
        let value = data.fields[f.name] ?? "";
        if (f.type === "date") value = value ? formatDate(value) : "";
        else if (f.name === "typeContrat") value = value ? optionLabel(TYPE_CONTRAT_OPTIONS, value) : "";
        else if (f.name === "statutPeriodeEssai") value = value ? optionLabel(STATUT_ESSAI_OPTIONS, value) : "";
        return `<tr><th>${escapeHtml(f.label)}</th><td>${cell(value)}</td></tr>`;
      })
      .join("");

  // Comma-joined (not just space-joined) so a re-uploaded copy of this PDF can
  // split multi-word tool names back apart reliably (see extract.ts).
  const outilsHtml = data.outilsAttribues.length
    ? data.outilsAttribues.map((o) => `<span class="tag">${escapeHtml(o)}</span>`).join(", ")
    : EMPTY;

  const piecesRows = data.pieces.length
    ? data.pieces
        .map(
          (p) => `
        <tr>
          <td>${cell(p.document)}</td>
          <td>${escapeHtml(p.statut || "En attente")}</td>
          <td>${p.dateReception ? escapeHtml(formatDate(p.dateReception)) : EMPTY}</td>
        </tr>`,
        )
        .join("")
    : `<tr><td colspan="3">${EMPTY}</td></tr>`;

  const section = (title: string, body: string) => `
    <section>
      <h2>${escapeHtml(title)}</h2>
      ${body}
    </section>`;

  const kvTable = (sectionId: string) => `<table class="kv">${rowsFor(sectionId)}</table>`;

  const sectionsHtml = SECTIONS.map((s) => {
    if (s.id === "pieces-justificatives") {
      return section(
        s.title,
        `<table class="grid">
           <thead><tr><th>Document</th><th>Statut</th><th>Date de réception</th></tr></thead>
           <tbody>${piecesRows}</tbody>
         </table>`,
      );
    }
    if (s.id === "coordonnees-acces-materiel") {
      return section(
        s.title,
        // Uses the same OUTILS_LABEL the parser anchors on (extract.ts), so a
        // re-uploaded copy of this PDF still resolves the field.
        `${kvTable(s.id)}
         <table class="kv"><tr><th>${escapeHtml(OUTILS_LABEL)}</th><td>${outilsHtml}</td></tr></table>`,
      );
    }
    return section(s.title, kvTable(s.id));
  }).join("");

  const fullName = [data.fields.prenom, data.fields.nom].filter(Boolean).join(" ").trim();

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<title>Dossier Salarié</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12px;
    color: #1a1a1a;
    margin: 0;
    padding: 40px 48px;
    line-height: 1.5;
  }
  .doc-title { font-size: 20px; font-weight: bold; margin: 0; }
  .doc-sub { color: #555; margin: 2px 0 4px; }
  .doc-meta { color: #888; font-size: 10px; margin-bottom: 24px; }
  section { margin-bottom: 22px; break-inside: avoid; }
  h2 {
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #4338ca;
    border-bottom: 2px solid #e0e7ff;
    padding-bottom: 4px;
    margin: 0 0 10px;
  }
  table { width: 100%; border-collapse: collapse; }
  table.kv th {
    text-align: left;
    width: 34%;
    font-weight: 600;
    color: #475569;
    padding: 5px 8px;
    vertical-align: top;
  }
  table.kv td { padding: 5px 8px; vertical-align: top; }
  table.kv tr { border-bottom: 1px solid #f1f5f9; }
  table.grid th, table.grid td {
    border: 1px solid #e2e8f0;
    padding: 6px 8px;
    text-align: left;
  }
  table.grid thead th { background: #f8fafc; color: #475569; font-weight: 600; }
  .muted { color: #cbd5e1; }
  .tag {
    display: inline-block;
    background: #eef2ff;
    color: #4338ca;
    border-radius: 6px;
    padding: 2px 8px;
    margin: 0 4px 4px 0;
    font-size: 11px;
  }
</style>
</head>
<body>
  <p class="doc-title">Dossier Salarié &amp; Fiche d'Identité Interne</p>
  ${fullName ? `<p class="doc-sub">${escapeHtml(fullName)}</p>` : ""}
  <p class="doc-meta">Document généré le ${formatDate(generatedAt.toISOString().slice(0, 10))}</p>
  ${sectionsHtml}
</body>
</html>`;
}
