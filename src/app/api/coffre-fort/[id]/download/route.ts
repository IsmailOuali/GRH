import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCompany } from "@/lib/company";
import { vaultDocPath } from "@/lib/coffre-fort";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const { id } = await params;
  const doc = await prisma.vaultDocument.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Document introuvable." }, { status: 404 });

  const role = session.user.role;
  const isHr = role === "MANAGER" || role === "ADMIN";
  if (isHr) {
    // HR may only reach documents inside their active company.
    const company = await getActiveCompany(role, session.user.company);
    if (doc.company !== company) {
      return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
    }
  } else if (doc.userId !== session.user.id) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  let buffer: Buffer;
  try {
    buffer = await readFile(vaultDocPath(doc.filename));
  } catch {
    return NextResponse.json({ error: "Fichier introuvable." }, { status: 404 });
  }

  const safeTitle = doc.title.replace(/[\\/:*?"<>|]+/g, " ").trim() || "document";
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": doc.mimeType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(safeTitle)}"`,
    },
  });
}
