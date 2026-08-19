import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const MIME: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  webp: "image/webp", gif: "image/gif", svg: "image/svg+xml",
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const { code } = await params;
  const company = await prisma.company.findUnique({ where: { code } });

  if (company?.logoPath) {
    const filePath = path.join(process.cwd(), "uploads", "companies", company.logoPath);
    try {
      const buffer = await readFile(filePath);
      const ext = company.logoPath.split(".").pop()?.toLowerCase() ?? "png";
      return new NextResponse(new Uint8Array(buffer), {
        headers: { "Content-Type": MIME[ext] ?? "image/png", "Cache-Control": "public, max-age=3600" },
      });
    } catch {
      /* fall through */
    }
  }

  // Legacy default logo for the original Fair'Up company.
  if (code === "FAIRUP") {
    try {
      const buffer = await readFile(path.join(process.cwd(), "document-templates/conge-payes/logo-bg.png"));
      return new NextResponse(new Uint8Array(buffer), {
        headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" },
      });
    } catch {
      /* fall through */
    }
  }

  return NextResponse.json({ error: "Logo introuvable." }, { status: 404 });
}
