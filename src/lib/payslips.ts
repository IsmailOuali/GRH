// Splits a multi-employee payslip PDF (1 page = 1 employee) and finds the owner
// of each page. Pure PDF + matching logic: no database, no disk.
import { PDFDocument } from "pdf-lib";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

export type PayslipEmployee = {
  id: string;
  name: string;
  /** From the employee's dossier (EmployeeDossier.matricule). */
  matricule?: string | null;
};

export type MatchedBy = "matricule" | "nom";

export type PageResult = {
  page: number;
  month: string | null;
  employee: PayslipEmployee | null;
  matchedBy: MatchedBy | null;
  /** Why the page could not be assigned (French, shown to the admin). */
  error?: string;
  /** The single-page PDF. Only produced for pages that have an owner. */
  bytes?: Uint8Array;
};

/** Upper-case, accent-free, single-spaced: the form used for all comparisons. */
const norm = (s: string | null | undefined) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whole-token match: "M00" must not match inside "M001". `text` is already normalised. */
const hasToken = (text: string, id: string | null | undefined) =>
  !!id && norm(id) !== "" && new RegExp(`(?<![A-Z0-9])${escapeRe(norm(id))}(?![A-Z0-9])`).test(text);

const nameWords = (name: string) =>
  norm(name)
    .split(" ")
    .filter((w) => w.length > 1);

/**
 * The words of the "Nom et Prénom" field ("… Nom et Prénom KABIL Youssef N° C.N.S.S …"
 * → ["KABIL", "YOUSSEF"]), or null when the page has no such field.
 * Matching the name against this field only — not the whole page — keeps words of the
 * header (company name, address: "1 Rue du Test") from being mistaken for an employee.
 */
function nameFieldWords(text: string): string[] | null {
  const m = text.match(/NOM ET PRENOM\s+(.*)/);
  if (!m) return null;
  const words: string[] = [];
  for (const w of m[1].split(" ")) {
    // The field ends at the next label / number ("N° C.N.S.S", dates, …).
    if (/[0-9°]/.test(w) || words.length >= 6) break;
    words.push(w);
  }
  const clean = words.filter((w) => w.length > 1);
  return clean.length > 0 ? clean : null;
}

/**
 * Full-name match. With a "Nom et Prénom" field, the employee's name words and the
 * field's words must be the same set (any order): "Kabil" is NOT "KABIL Youssef", and
 * "test" is not "INCONNU Test" — a wrong payslip owner is worse than an unassigned page.
 * Without such a field, every word of the name must appear as a whole token on the page.
 */
const hasName = (text: string, name: string) => {
  const words = nameWords(name);
  if (words.length === 0) return false;
  const field = nameFieldWords(text);
  if (field) return words.length === field.length && words.every((w) => field.includes(w));
  return words.every((w) => hasToken(text, w));
};

// Most reliable first. A level that finds nobody falls through to the next one;
// a level that finds several people stops there as "ambiguous".
const MATCHERS: [MatchedBy, (text: string, e: PayslipEmployee) => boolean][] = [
  ["matricule", (t, e) => hasToken(t, e.matricule)],
  ["nom", (t, e) => hasName(t, e.name)],
];

export function findOwner(
  pageText: string,
  employees: PayslipEmployee[],
): { employee: PayslipEmployee | null; matchedBy: MatchedBy | null; error?: string } {
  const text = norm(pageText);
  for (const [by, test] of MATCHERS) {
    const hits = employees.filter((e) => test(text, e));
    if (hits.length === 1) return { employee: hits[0], matchedBy: by };
    if (hits.length > 1) {
      const label = by === "matricule" ? "matricule" : "nom";
      return { employee: null, matchedBy: by, error: `ambigu : ${hits.length} salariés correspondent (${label})` };
    }
  }
  return { employee: null, matchedBy: null, error: "aucun salarié reconnu" };
}

export async function extractPageTexts(pdfBytes: Uint8Array): Promise<string[]> {
  const task = pdfjs.getDocument({
    data: new Uint8Array(pdfBytes), // pdfjs takes ownership of the buffer it is given
    useSystemFonts: true,
  });
  const doc = await task.promise;
  try {
    const texts: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      texts.push(
        content.items
          .map((it) => ("str" in it ? it.str : ""))
          .join(" "),
      );
    }
    return texts;
  } finally {
    await task.destroy();
  }
}

/** "Période : Février 2025 ( Du 01/02/2025 ..." → "Février 2025" */
export function extractMonth(pageText: string): string | null {
  const m = pageText.match(/P[ée]riode\s*:\s*([A-Za-zÀ-ÿ]+\s+\d{4})/);
  return m ? m[1] : null;
}

/**
 * @param pdfBytes  global PDF (1 page = 1 payslip)
 * @param employees candidates for the match — the caller scopes them (company…)
 */
export async function splitPayslips(
  pdfBytes: Uint8Array,
  employees: PayslipEmployee[],
): Promise<PageResult[]> {
  const texts = await extractPageTexts(pdfBytes);
  const src = await PDFDocument.load(pdfBytes);
  const results: PageResult[] = [];

  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];
    const month = extractMonth(text);
    const owner = text.trim()
      ? findOwner(text, employees)
      : { employee: null, matchedBy: null, error: "page sans texte (OCR nécessaire)" };

    let bytes: Uint8Array | undefined;
    if (owner.employee) {
      const out = await PDFDocument.create();
      const [copied] = await out.copyPages(src, [i]);
      out.addPage(copied);
      bytes = await out.save();
    }

    results.push({ page: i + 1, month, ...owner, bytes });
  }
  return results;
}
