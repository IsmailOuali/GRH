import path from "path";
import { prisma } from "@/lib/prisma";

/**
 * The coffre-fort ("digital safe") is a per-employee, unified view of every
 * document the company holds for them. It has one native store — VaultDocument,
 * where HR files free-form documents (contrat, CIN, RIB…) — and it *surfaces*
 * two existing stores read-only so nothing is scattered:
 *   - Payslip           → category BULLETIN
 *   - DocumentRequest    → category ADMINISTRATIF (approved attestations only)
 * Those two are never copied here; they are linked in place.
 */

export type VaultCategory =
  | "BULLETIN"
  | "CONTRAT"
  | "ADMINISTRATIF"
  | "JUSTIFICATIF"
  | "AUTRE";

export const CATEGORY_LABELS: Record<VaultCategory, string> = {
  BULLETIN: "Bulletins de paie",
  CONTRAT: "Contrats",
  ADMINISTRATIF: "Documents administratifs",
  JUSTIFICATIF: "Pièces justificatives",
  AUTRE: "Autres documents",
};

/** Categories HR can choose when filing a native document. BULLETIN is excluded
 *  — bulletins arrive from the Paie module, never as a manual upload here. */
export const UPLOADABLE_CATEGORIES: VaultCategory[] = [
  "CONTRAT",
  "ADMINISTRATIF",
  "JUSTIFICATIF",
  "AUTRE",
];

export type VaultSource = "vault" | "payslip" | "document";

export type VaultItem = {
  /** Namespaced id, unique across sources: "vault:<id>", "payslip:<id>"… */
  key: string;
  source: VaultSource;
  category: VaultCategory;
  title: string;
  createdAt: Date;
  /** Year, for the archive grouping. */
  year: number;
  downloadUrl: string;
  /** Only native vault documents can be removed from the coffre-fort. */
  deletable: boolean;
  /** Short secondary line, e.g. "Ajouté par Marie D." or "Attestation". */
  meta?: string;
};

/**
 * Every document in an employee's coffre-fort, newest first. Merges the native
 * store with the linked bulletins and approved attestations.
 */
export async function getVaultForUser(userId: string): Promise<VaultItem[]> {
  const [vaultDocs, payslips, docRequests] = await Promise.all([
    prisma.vaultDocument.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { uploadedBy: { select: { name: true } } },
    }),
    prisma.payslip.findMany({
      where: { userId, pdfPath: { not: null } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.documentRequest.findMany({
      where: { userId, status: "APPROVED", pdfPath: { not: null } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const items: VaultItem[] = [];

  for (const d of vaultDocs) {
    items.push({
      key: `vault:${d.id}`,
      source: "vault",
      category: (d.category as VaultCategory) ?? "AUTRE",
      title: d.title,
      createdAt: d.createdAt,
      year: d.createdAt.getFullYear(),
      downloadUrl: `/api/coffre-fort/${d.id}/download`,
      deletable: true,
      meta: `Ajouté par ${d.uploadedBy?.name ?? "RH"}`,
    });
  }

  for (const p of payslips) {
    items.push({
      key: `payslip:${p.id}`,
      source: "payslip",
      category: "BULLETIN",
      title: `Bulletin de paie — ${p.month}`,
      createdAt: p.createdAt,
      year: p.createdAt.getFullYear(),
      downloadUrl: `/api/payslips/${p.id}/download`,
      deletable: false,
      meta: "Depuis Paie",
    });
  }

  for (const r of docRequests) {
    const created = r.reviewedAt ?? r.createdAt;
    items.push({
      key: `document:${r.id}`,
      source: "document",
      category: "ADMINISTRATIF",
      title: prettyTemplateId(r.templateId),
      createdAt: created,
      year: created.getFullYear(),
      downloadUrl: `/api/documents/download/${r.id}`,
      deletable: false,
      meta: "Attestation",
    });
  }

  items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return items;
}

/** A file on disk to include in a "download all" archive. */
export type VaultFile = { name: string; absPath: string };

/**
 * Resolves every downloadable file in a user's coffre-fort to an absolute path
 * on disk, with a collision-free, human-readable name for the archive.
 */
export async function collectVaultFiles(userId: string): Promise<VaultFile[]> {
  const [vaultDocs, payslips, docRequests] = await Promise.all([
    prisma.vaultDocument.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    prisma.payslip.findMany({
      where: { userId, pdfPath: { not: null } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.documentRequest.findMany({
      where: { userId, status: "APPROVED", pdfPath: { not: null } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const files: VaultFile[] = [];
  const used = new Set<string>();
  const add = (rawName: string, ext: string, absPath: string) => {
    const base = sanitize(rawName) || "document";
    let name = `${base}.${ext}`;
    let n = 2;
    while (used.has(name.toLowerCase())) name = `${base}-${n++}.${ext}`;
    used.add(name.toLowerCase());
    files.push({ name, absPath });
  };

  for (const d of vaultDocs) {
    const ext = extFromMime(d.mimeType) ?? (path.extname(d.filename).replace(".", "") || "pdf");
    add(`${d.createdAt.getFullYear()} - ${d.title}`, ext, vaultDocPath(d.filename));
  }
  for (const p of payslips) {
    add(`Bulletin ${p.month}`, "pdf", path.join(process.cwd(), "uploads", "payslips", p.pdfPath!));
  }
  for (const r of docRequests) {
    // DocumentRequest.pdfPath is stored as an absolute path.
    add(prettyTemplateId(r.templateId), "pdf", r.pdfPath!);
  }
  return files;
}

/** Absolute on-disk path for a native vault document's stored file. */
export function vaultDocPath(filename: string): string {
  return path.join(process.cwd(), "uploads", "coffre-fort", filename);
}

function prettyTemplateId(templateId: string): string {
  return templateId
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function sanitize(name: string): string {
  return name
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

const MIME_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
};

function extFromMime(mime: string): string | null {
  return MIME_EXT[mime] ?? null;
}

/** Accepted upload types for a native vault document. */
export const ACCEPTED_MIME_TYPES = Object.keys(MIME_EXT);
