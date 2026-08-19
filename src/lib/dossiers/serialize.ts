/**
 * Conversion helpers between the EmployeeDossier Prisma row (flat columns,
 * JSON stored as String) and the structured DossierData used by the form/API.
 * Centralized so the page, save action, and generate route never diverge.
 */

import {
  SCALAR_FIELDS,
  PIECE_DOCUMENTS,
  emptyDossierData,
  type DossierData,
  type DossierPiece,
} from "./schema";

/** A Prisma EmployeeDossier row (only the parts we read), kept loose on purpose. */
type DossierRow = Record<string, unknown>;

function safeParseArray<T>(raw: unknown): T[] {
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

/** Build the structured DossierData from a Prisma row. */
export function dossierToData(row: DossierRow): DossierData {
  const base = emptyDossierData();

  for (const f of SCALAR_FIELDS) {
    const v = row[f.name];
    base.fields[f.name] = typeof v === "string" ? v : "";
  }

  base.outilsAttribues = safeParseArray<string>(row.outilsAttribues)
    .filter((s) => typeof s === "string" && s.trim().length > 0);

  const storedPieces = safeParseArray<DossierPiece>(row.pieces).filter(
    (p) => p && typeof p.document === "string",
  );
  if (storedPieces.length > 0) {
    base.pieces = storedPieces.map((p) => ({
      document: String(p.document),
      statut: p.statut === "Reçu" ? "Reçu" : "En attente",
      dateReception: typeof p.dateReception === "string" ? p.dateReception : "",
    }));
  }
  // else keep the canonical empty checklist from emptyDossierData()

  return base;
}

/** Sanitize + flatten DossierData into EmployeeDossier column values. */
export function dataToColumns(data: DossierData): Record<string, string> {
  const columns: Record<string, string> = {};

  for (const f of SCALAR_FIELDS) {
    columns[f.name] = (data.fields[f.name] ?? "").trim();
  }

  const outils = (data.outilsAttribues ?? [])
    .map((s) => String(s).trim())
    .filter(Boolean);

  const pieces = (data.pieces ?? [])
    .filter((p) => p && typeof p.document === "string" && p.document.trim())
    .map((p) => ({
      document: String(p.document).trim(),
      statut: p.statut === "Reçu" ? "Reçu" : "En attente",
      dateReception: typeof p.dateReception === "string" ? p.dateReception.trim() : "",
    }));

  columns.outilsAttribues = JSON.stringify(outils);
  columns.pieces = JSON.stringify(pieces.length > 0 ? pieces : PIECE_DOCUMENTS.map((document) => ({ document, statut: "En attente", dateReception: "" })));

  return columns;
}
