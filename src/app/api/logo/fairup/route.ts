import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

export function GET() {
  const logoPath = path.join(
    process.cwd(),
    "document-templates/conge-payes/logo-bg.png",
  );
  const buffer = fs.readFileSync(logoPath);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
