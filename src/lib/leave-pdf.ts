import path from "path";
import fs from "fs";
import { format } from "date-fns";
import { nextBusinessDay } from "@/lib/dates";
import { getAidDates } from "@/lib/aid-server";
import { TEMPLATES_MAP } from "@/lib/documents/templates.config";
import { renderTemplate } from "@/lib/documents/render-template";
import { generatePdf } from "@/lib/documents/generate-pdf";

/**
 * Renders the "Demande de congés payés" attestation for an approved CP
 * request — the same template Documents used to offer standalone, now
 * generated automatically instead of as a separate DocumentRequest.
 */
export async function generateCongePayesPdf(request: {
  id: string;
  days: number;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  user: { name: string };
}): Promise<string> {
  const template = TEMPLATES_MAP["conge-payes"];
  const fields: Record<string, string> = {
    nom_salarie: request.user.name,
    date_demande: format(request.createdAt, "dd/MM/yyyy"),
    date_debut: format(request.startDate, "dd/MM/yyyy"),
    date_fin: format(request.endDate, "dd/MM/yyyy"),
    nombre_jours: String(request.days),
    date_reprise: format(nextBusinessDay(request.endDate, await getAidDates()), "dd/MM/yyyy"),
  };

  const templatePath = path.join(process.cwd(), template.templatePath);
  const templateDir = path.dirname(templatePath);
  const html = fs.readFileSync(templatePath, "utf-8");
  const rendered = renderTemplate(html, fields);
  const pdf = await generatePdf(rendered, templateDir);

  const dir = path.join(process.cwd(), "uploads", "leaves");
  fs.mkdirSync(dir, { recursive: true });
  const pdfPath = path.join(dir, `${request.id}-conge-payes.pdf`);
  fs.writeFileSync(pdfPath, pdf);
  return pdfPath;
}
