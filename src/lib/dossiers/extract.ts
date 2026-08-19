/**
 * Label-anchored extraction for the Fair'Up "Dossier Salarié" intake form.
 *
 * This module is intentionally PURE (no I/O, no pdf-parse import) so it can be
 * unit-tested on raw strings. The PDF→text step lives in ./pdf.ts.
 *
 * The form is a fixed-layout table with NO "Label : value" colons — pdf-parse
 * emits "Label value" runs. So we collapse all whitespace and then segment the
 * text by known label/section anchors: each field's value is whatever sits
 * between its label and the next anchor. This is colon-agnostic and robust to
 * the table wrapping cells across lines. We never guess freeform; anything that
 * can't be confidently resolved is left empty and reported in `unresolved`.
 */

import {
  SCALAR_FIELDS,
  PIECE_DOCUMENTS,
  PIECE_STATUT_OPTIONS,
  OUTILS_LABELS,
  STOP_PHRASES,
  type DossierData,
  type DossierPiece,
  type DossierField,
} from "./schema";

export interface ExtractedDossier extends DossierData {
  /** Field names (incl. "outilsAttribues" / "pieces") the parser left empty. */
  unresolved: string[];
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Latin-letter-bounded match of `label` (so "Nom" won't match inside "Prénom"). */
function labelRegex(label: string): RegExp {
  return new RegExp("(?<![A-Za-zÀ-ÿ])" + escapeRe(label) + "(?![A-Za-zÀ-ÿ])", "gi");
}

/**
 * Normalize a date string to yyyy-mm-dd (what <input type="date"> expects).
 * Accepts dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy and yyyy-mm-dd. Returns "" otherwise.
 */
export function normalizeDate(raw: string): string {
  const s = raw.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return "";
}

// A "ticked" checkbox: bracketed/parenthesized with x/X/✓/✔ inside, OR a bare
// check glyph (some forms print "✓ CDI" with no brackets at all).
const TICK = "(?:\\[\\s*[xX✓✔]\\s*\\]|\\(\\s*[xX✓✔]\\s*\\)|[☑☒✅✓✔])";

/** First option whose label is immediately preceded by a ticked box. */
function detectTick(segment: string, options: { value: string; terms: string[] }[]): string | null {
  for (const opt of options) {
    for (const term of opt.terms) {
      if (new RegExp(`${TICK}\\s*${escapeRe(term)}`, "i").test(segment)) return opt.value;
    }
  }
  return null;
}

/**
 * Extract the labels of every TICKED option in a checkbox group, generically —
 * works whether the form uses "[X] Foo [ ] Bar" or bare "✓ Foo ✓ Bar", and
 * without needing a fixed list of option names (which varies per company).
 */
function extractTickedLabels(segment: string): string[] {
  const markerRe = /\[\s*[xX✓✔]?\s*\]|\(\s*[xX✓✔]?\s*\)|[☑☒✅✓✔☐]/g;
  const marks = [...segment.matchAll(markerRe)].map((m) => ({
    index: m.index ?? 0,
    length: m[0].length,
    ticked: /[xX✓✔☑☒✅]/.test(m[0]),
  }));

  const labels: string[] = [];
  for (let i = 0; i < marks.length; i++) {
    if (!marks[i].ticked) continue;
    const start = marks[i].index + marks[i].length;
    const end = i + 1 < marks.length ? marks[i + 1].index : segment.length;
    const label = segment.slice(start, end).replace(/^[\s:–—-]+|[\s,;]+$/g, "").trim();
    if (label) labels.push(label);
  }
  return labels;
}

function findCheckboxField(segment: string, field: DossierField): string | null {
  const ticked = detectTick(
    segment,
    (field.options ?? []).map((o) => ({ value: o.value, terms: [o.label, o.value.replace(/_/g, " ")] })),
  );
  if (ticked) return ticked;

  // No checkbox markup found — this is what our OWN regenerated PDF looks
  // like when re-uploaded (render-html.ts prints the resolved option as
  // plain text, no brackets). Fall back to an exact match on the cleaned
  // segment so re-importing a previously-generated dossier doesn't lose it.
  const cleaned = cleanValue(segment);
  for (const opt of field.options ?? []) {
    if (cleaned === opt.label || cleaned === opt.value) return opt.value;
  }
  return null;
}

/**
 * Strip placeholder dashes / leading separators, and a trailing section-number
 * marker (e.g. "2.") that precedes the next section header. "-" means "blank".
 */
function cleanValue(raw: string): string {
  let v = raw.replace(/^[\s:–—-]+/, "").trim();
  v = v.replace(/\s*\b\d{1,2}\.\s*$/, "").trim();
  return v === "-" || v === "–" || v === "—" ? "" : v;
}

// ── Anchor segmentation ───────────────────────────────────────────────────────

type Anchor =
  | { start: number; end: number; len: number; kind: "field"; field: DossierField }
  | { start: number; end: number; len: number; kind: "outils" }
  | { start: number; end: number; len: number; kind: "piece"; index: number }
  | { start: number; end: number; len: number; kind: "stop" };

function collect(text: string, label: string, make: (start: number, end: number) => Anchor, out: Anchor[]) {
  for (const m of text.matchAll(labelRegex(label))) {
    const start = m.index ?? 0;
    out.push(make(start, start + m[0].length));
  }
}

/**
 * Parse raw PDF text into a best-effort structured dossier.
 * Pure function — safe to unit test.
 */
export function parseDossierText(text: string): ExtractedDossier {
  // Normalize curly apostrophes → straight (labels use straight '), strip the
  // literal "-- N of M --" page-break marker pdf-parse inserts between pages
  // of a multi-page PDF (noise, not document content), and collapse ALL
  // whitespace (incl. newlines) so wrapped table cells join up.
  const flat = text
    .replace(/[’‘]/g, "'")
    .replace(/--\s*\d+\s+of\s+\d+\s*--/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  // 1) Gather every possible anchor.
  const anchors: Anchor[] = [];
  for (const field of SCALAR_FIELDS) {
    for (const label of field.parseLabels) {
      collect(flat, label, (start, end) => ({ start, end, len: end - start, kind: "field", field }), anchors);
    }
  }
  for (const label of OUTILS_LABELS) {
    collect(flat, label, (start, end) => ({ start, end, len: end - start, kind: "outils" }), anchors);
  }
  PIECE_DOCUMENTS.forEach((doc, index) => {
    collect(flat, doc, (start, end) => ({ start, end, len: end - start, kind: "piece", index }), anchors);
  });
  for (const phrase of STOP_PHRASES) {
    collect(flat, phrase, (start, end) => ({ start, end, len: end - start, kind: "stop" }), anchors);
  }

  // 2) Resolve overlaps: earliest start first, longest label wins ties; then
  //    greedily keep non-overlapping anchors left to right.
  anchors.sort((a, b) => a.start - b.start || b.len - a.len);
  const selected: Anchor[] = [];
  let lastEnd = -1;
  for (const a of anchors) {
    if (a.start >= lastEnd) {
      selected.push(a);
      lastEnd = a.end;
    }
  }

  // 3) Slice each anchor's value as the text up to the next anchor.
  const fields: Record<string, string> = {};
  for (const f of SCALAR_FIELDS) fields[f.name] = "";
  let outils: string[] = [];
  const pieces: DossierPiece[] = PIECE_DOCUMENTS.map((document) => ({ document, statut: "En attente", dateReception: "" }));
  const assignedFields = new Set<string>();
  let outilsFound = false;
  let piecesFound = false;

  selected.forEach((a, i) => {
    const next = selected[i + 1];
    const segment = flat.slice(a.end, next ? next.start : flat.length).trim();

    if (a.kind === "field") {
      if (assignedFields.has(a.field.name)) return;
      assignedFields.add(a.field.name);
      if (a.field.checkbox) {
        fields[a.field.name] = findCheckboxField(segment, a.field) ?? "";
      } else if (a.field.type === "date") {
        fields[a.field.name] = normalizeDate(cleanValue(segment));
      } else {
        fields[a.field.name] = cleanValue(segment);
      }
    } else if (a.kind === "outils") {
      outils = extractTickedLabels(segment);
      if (outils.length === 0) {
        // No checkbox markup — our own regenerated PDF prints the list as
        // comma-separated plain text (render-html.ts). Fall back to a split.
        const cleaned = cleanValue(segment);
        if (cleaned) outils = cleaned.split(/\s*,\s*/).map((s) => s.trim()).filter(Boolean);
      }
      outilsFound = outils.length > 0;
    } else if (a.kind === "piece") {
      piecesFound = true;
      // Prefer a ticked box; else fall back to whichever status WORD appears
      // (some forms print a plain "Reçu" badge with no checkbox at all).
      let statut = detectTick(segment, PIECE_STATUT_OPTIONS.map((s) => ({ value: s, terms: [s] })));
      if (!statut) {
        const hasRecu = /re[çc]u/i.test(segment);
        const hasAttente = /en\s+attente/i.test(segment);
        if (hasRecu && !hasAttente) statut = "Reçu";
        else if (hasAttente && !hasRecu) statut = "En attente";
      }
      const dateMatch = /(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{4}|\d{4}-\d{2}-\d{2})/.exec(segment);
      pieces[a.index] = {
        document: PIECE_DOCUMENTS[a.index],
        statut: statut ?? "En attente",
        dateReception: dateMatch ? normalizeDate(dateMatch[1]) : "",
      };
    }
  });

  // 4) Report what couldn't be resolved.
  const unresolved: string[] = [];
  for (const f of SCALAR_FIELDS) if (!fields[f.name]) unresolved.push(f.name);
  if (!outilsFound) unresolved.push("outilsAttribues");
  if (!piecesFound) unresolved.push("pieces");

  return { fields, outilsAttribues: outils, pieces, unresolved };
}
