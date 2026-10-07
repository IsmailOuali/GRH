/**
 * Parser for the "Salariés" sheet of the Suivi RH workbook, exported as CSV.
 *
 * Written by hand rather than pulled from a library because the file needs
 * exactly two non-trivial things — quoted fields (French decimals like "14,0"
 * contain the delimiter) and a tolerant header scan — and both fit in a page.
 */

/** Minimal RFC-4180 reader: handles quoted fields and "" escapes. */
export function parseCsv(text: string): string[][] {
  // Excel prefixes UTF-8 exports with a BOM; left in place it corrupts the
  // first header cell and every column lookup after it fails.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
      continue;
    }

    if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

/** Collapses inner runs of whitespace and trims — the sheet's names carry
 *  trailing spaces ("RHEZOUANE "), which silently break every name match. */
export function normalizeName(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** French decimal ("14,0", "1 234,5") → number. Empty/blank → null. */
export function parseFrNumber(raw: string): number | null {
  const s = (raw ?? "").replace(/\u00a0/g, " ").trim();
  if (!s) return null;
  const n = Number(s.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export type DateParse =
  | { iso: string; warning?: string }
  | { iso: null; warning: string };

/**
 * "d/m/yyyy" → "yyyy-mm-dd".
 *
 * Deliberately forgiving about separators, because the source data contains
 * "23//03/2026" — a double slash typo that a strict parser would drop on the
 * floor. Anything it repairs or rejects comes back with a warning so the
 * import preview can show it rather than silently guessing.
 */
export function parseFrDate(raw: string): DateParse {
  const s = (raw ?? "").trim();
  if (!s) return { iso: null, warning: "" };

  const cleaned = s.replace(/\/{2,}/g, "/");
  const repaired = cleaned !== s;

  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(cleaned);
  if (!m) return { iso: null, warning: `date illisible « ${s} »` };

  const day = Number(m[1]), month = Number(m[2]), year = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31)
    return { iso: null, warning: `date invalide « ${s} »` };

  // Reject e.g. 31/02: round-tripping through Date catches overflow days.
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day)
    return { iso: null, warning: `date inexistante « ${s} »` };

  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return repaired ? { iso, warning: `séparateur corrigé « ${s} » → ${iso}` } : { iso };
}

export type SalarieRow = {
  externalId: number | null;
  nom: string;
  prenom: string;
  nomComplet: string;
  poste: string | null;
  dateEntree: string | null;
  soldeCongesN: number | null;
  repriseCongesPris: number;
  repriseAbsences: number;
  repriseRetardsNb: number;
  repriseRetardsH: number;
  /** Row-level notes surfaced in the import preview. */
  warnings: string[];
};

export type ParseResult = {
  rows: SalarieRow[];
  /** File-level problems (missing header, no data rows…). */
  errors: string[];
};

/** Header cells we need, matched loosely so accents/case/spacing can drift. */
const COLUMNS = {
  id: /^id$/,
  nom: /^nom$/,
  prenom: /^pr.?nom$/,
  // "Tableau de bord" sheet: one combined "Salarié" column ("Prénom NOM")
  // instead of split Nom/Prénom. Anchored (no trailing text) so it can't also
  // catch the summary band's "Salariés suivis" cell.
  salarie: /^salari[ée]s?$/,
  nomComplet: /^nom\s*complet$/,
  poste: /^poste$/,
  dateEntree: /^date\s*d.?\s*entr/,
  soldeCongesN: /^solde\s*cong/,
  congesPris: /^cong.?s\s*pris/,
  absences: /^absences/,
  retardsNb: /^retards.*\(nb\)/,
  retardsH: /^retards.*\(h\)/,
} as const;

function findHeader(rows: string[][]): { index: number; map: Record<string, number> } | null {
  // The export carries a title block ("LISTE DES SALARIÉS" + blank lines)
  // above the real header, so scan for the row that looks like column names.
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const cells = rows[i].map((c) => normalizeName(c).toLowerCase());
    const map: Record<string, number> = {};
    for (const [key, re] of Object.entries(COLUMNS)) {
      const idx = cells.findIndex((c) => re.test(c));
      if (idx !== -1) map[key] = idx;
    }
    if (map.nom !== undefined && map.prenom !== undefined) return { index: i, map };
  }
  return null;
}

export function parseSalariesCsv(text: string): ParseResult {
  const raw = parseCsv(text);
  const header = findHeader(raw);
  if (!header) {
    return {
      rows: [],
      errors: ["En-tête introuvable — attendu des colonnes « Nom » et « Prénom »."],
    };
  }

  const { index, map } = header;
  const at = (row: string[], key: keyof typeof COLUMNS) =>
    map[key] === undefined ? "" : (row[map[key]] ?? "");

  const rows: SalarieRow[] = [];
  const seen = new Map<string, number>();
  const errors: string[] = [];

  for (let i = index + 1; i < raw.length; i++) {
    const row = raw[i];
    // The export ends with a padding row of empty cells (and one stray space).
    if (row.every((c) => !c.trim())) continue;

    const nom = normalizeName(at(row, "nom"));
    const prenom = normalizeName(at(row, "prenom"));
    if (!nom && !prenom) continue;

    const warnings: string[] = [];

    // Prefer the sheet's own "Nom complet", falling back to "Prénom NOM".
    const nomComplet = normalizeName(at(row, "nomComplet")) || normalizeName(`${prenom} ${nom}`);

    const dup = seen.get(nomComplet.toLowerCase());
    if (dup !== undefined) {
      errors.push(`Ligne ${i + 1} : « ${nomComplet} » en double (déjà ligne ${dup}).`);
      continue;
    }
    seen.set(nomComplet.toLowerCase(), i + 1);

    const entree = parseFrDate(at(row, "dateEntree"));
    if (entree.warning) warnings.push(entree.warning);

    const externalId = parseFrNumber(at(row, "id"));
    const solde = parseFrNumber(at(row, "soldeCongesN"));
    if (solde === null) warnings.push("solde congés non renseigné");

    rows.push({
      externalId: externalId === null ? null : Math.trunc(externalId),
      nom,
      prenom,
      nomComplet,
      poste: normalizeName(at(row, "poste")) || null,
      dateEntree: entree.iso,
      soldeCongesN: solde,
      repriseCongesPris: parseFrNumber(at(row, "congesPris")) ?? 0,
      repriseAbsences: parseFrNumber(at(row, "absences")) ?? 0,
      repriseRetardsNb: Math.trunc(parseFrNumber(at(row, "retardsNb")) ?? 0),
      repriseRetardsH: parseFrNumber(at(row, "retardsH")) ?? 0,
      warnings,
    });
  }

  if (rows.length === 0) errors.push("Aucun salarié trouvé dans le fichier.");
  return { rows, errors };
}
