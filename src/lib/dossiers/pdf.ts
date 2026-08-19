import { PDFParse } from "pdf-parse";
import { parseDossierText, type ExtractedDossier } from "./extract";

/** Extract the concatenated plain text from a PDF buffer. */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text ?? "";
  } finally {
    await parser.destroy();
  }
}

/** Read a PDF buffer and return the best-effort structured dossier. */
export async function extractDossierFromPdf(buffer: Buffer): Promise<ExtractedDossier> {
  const text = await extractTextFromPdf(buffer);
  return parseDossierText(text);
}
