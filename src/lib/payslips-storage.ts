import { randomBytes } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notifications";

/** Where payslip PDFs live on disk. Shared with the download route. */
export const PAYSLIPS_DIR = path.join(process.cwd(), "uploads", "payslips");

/**
 * Canonical form of a "Mois" value, used to compare months ("février 2025" and
 * "Fevrier  2025" are the same month). Not meant for display.
 */
export function monthKey(mois: string): string {
  return mois
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Display form the app uses for "Mois": "Juin 2025" (first letter capitalised). */
export function formatMonth(mois: string): string {
  const clean = mois.replace(/\s+/g, " ").trim();
  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
}

/**
 * Store one payslip PDF (file on disk + Payslip row) and notify the employee.
 * The single and the bulk upload both go through here, so they stay identical.
 *
 * The file name keeps the historical `{timestamp}-{userId}` shape plus a short
 * random suffix: a bulk upload can save several months for one employee within
 * the same millisecond.
 */
export async function saveBulletin({
  userId,
  mois,
  pdfBytes,
}: {
  userId: string;
  mois: string;
  pdfBytes: Uint8Array;
}) {
  await mkdir(PAYSLIPS_DIR, { recursive: true });

  const filename = `${Date.now()}-${userId}-${randomBytes(3).toString("hex")}.pdf`;
  const filePath = path.join(PAYSLIPS_DIR, filename);
  await writeFile(filePath, pdfBytes);

  let payslip;
  try {
    payslip = await prisma.payslip.create({ data: { userId, month: mois, pdfPath: filename } });
  } catch (err) {
    // Don't leave an orphan file behind when the row could not be written.
    await unlink(filePath).catch(() => {});
    throw err;
  }

  // Best effort: a notification problem must not undo a stored payslip.
  await notifyUser(
    userId,
    "PAYSLIP_ADDED",
    `Votre bulletin de paie de ${mois} est disponible.`,
    "/paie",
  ).catch((err) => console.error("[payslips] notification non envoyée:", err));

  return payslip;
}
