import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export type CompanyInfo = {
  code: string;
  name: string;
  tagline: string | null;
  logoPath: string | null;
};

/** All companies in the espace, oldest first. */
export async function listCompanies(): Promise<CompanyInfo[]> {
  const rows = await prisma.company.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map((c) => ({ code: c.code, name: c.name, tagline: c.tagline, logoPath: c.logoPath }));
}

/** Whether a company code exists. */
export async function companyExists(code: string): Promise<boolean> {
  if (!code) return false;
  return (await prisma.company.count({ where: { code } })) > 0;
}

/** Returns the active company for the current request.
 *  - EMPLOYEE: always their own company from the session.
 *  - MANAGER / ADMIN: whichever company they picked (cookie), fallback to their own. */
export async function getActiveCompany(
  role: string,
  sessionCompany: string,
): Promise<string> {
  if (role === "EMPLOYEE") return sessionCompany;
  const cookieStore = await cookies();
  return cookieStore.get("active_company")?.value ?? sessionCompany;
}
