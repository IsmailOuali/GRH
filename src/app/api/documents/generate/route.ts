import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { auth } from '@/auth';
import { TEMPLATES_MAP } from '@/lib/documents/templates.config';
import { renderTemplate } from '@/lib/documents/render-template';
import { generatePdf } from '@/lib/documents/generate-pdf';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  if (session.user.role !== 'MANAGER' && session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  const body = await req.json() as { templateId?: string; fields?: Record<string, string> };
  const { templateId, fields = {} } = body;

  const template = templateId ? TEMPLATES_MAP[templateId] : undefined;
  if (!template) {
    return NextResponse.json({ error: 'Modèle introuvable' }, { status: 400 });
  }

  const missing = template.fields
    .filter((f) => f.required && !fields[f.name]?.trim())
    .map((f) => f.label);
  if (missing.length > 0) {
    return NextResponse.json({ error: `Champs manquants : ${missing.join(', ')}` }, { status: 400 });
  }

  // Format date fields from yyyy-mm-dd → dd/mm/yyyy for display in the PDF
  const formattedFields = { ...fields };
  for (const field of template.fields) {
    if (field.type === 'date' && formattedFields[field.name]) {
      const [y, m, d] = formattedFields[field.name].split('-');
      if (y && m && d) formattedFields[field.name] = `${d}/${m}/${y}`;
    }
  }

  const templatePath = path.join(process.cwd(), template.templatePath);
  const templateDir = path.dirname(templatePath);
  const html = await fs.readFile(templatePath, 'utf-8');
  const rendered = renderTemplate(html, formattedFields);
  const pdf = await generatePdf(rendered, templateDir);

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${templateId}.pdf"`,
    },
  });
}
