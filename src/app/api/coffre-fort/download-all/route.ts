import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCompany } from "@/lib/company";
import { collectVaultFiles } from "@/lib/coffre-fort";
import { buildZip } from "@/lib/zip";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const role = session.user.role;
  const isHr = role === "MANAGER" || role === "ADMIN";
  const requestedUserId = req.nextUrl.searchParams.get("userId")?.trim();

  // Employees can only archive their own vault; HR may target any employee
  // inside their active company.
  let targetUserId = session.user.id;
  let targetName = session.user.name ?? "coffre-fort";
  if (isHr && requestedUserId) {
    const company = await getActiveCompany(role, session.user.company);
    const target = await prisma.user.findFirst({
      where: { id: requestedUserId, company },
      select: { id: true, name: true },
    });
    if (!target) return NextResponse.json({ error: "Employé introuvable." }, { status: 404 });
    targetUserId = target.id;
    targetName = target.name;
  }

  const files = await collectVaultFiles(targetUserId);
  if (files.length === 0) {
    return NextResponse.json({ error: "Aucun document à archiver." }, { status: 404 });
  }

  const entries: { name: string; data: Buffer }[] = [];
  for (const f of files) {
    try {
      entries.push({ name: f.name, data: await readFile(f.absPath) });
    } catch {
      // Skip a file whose row exists but whose bytes are missing on disk,
      // rather than failing the whole archive.
    }
  }
  if (entries.length === 0) {
    return NextResponse.json({ error: "Aucun fichier disponible." }, { status: 404 });
  }

  const zip = buildZip(entries);
  const safeName = targetName.replace(/[\\/:*?"<>|]+/g, " ").trim() || "coffre-fort";
  return new NextResponse(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="coffre-fort-${encodeURIComponent(safeName)}.zip"`,
    },
  });
}
