"use server";

import path from "path";
import { writeFile, mkdir, rm } from "fs/promises";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isMailConfigured, sendPasswordResetEmail } from "@/lib/mail";
import { generateResetToken, RESET_TOKEN_TTL_MS } from "@/lib/reset-tokens";
import { accrueLeaveBalance, initialAccrualAnchor, startOfMonth } from "@/lib/accrual";

async function requireManager() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "MANAGER"))
    throw new Error("Accès refusé.");
  const cookieStore = await cookies();
  const company = cookieStore.get("active_company")?.value ?? session.user.company ?? "FAIRUP";
  return { ...session.user, activeCompany: company };
}

export async function createEmployee(formData: FormData) {
  const admin = await requireManager();

  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;
  const role = formData.get("role") as string;
  const position = (formData.get("position") as string)?.trim() || null;
  const managerId = (formData.get("managerId") as string) || null;

  if (!name || !email || !password || !role) return { error: "Champs obligatoires manquants." };
  if (password.length < 6) return { error: "Le mot de passe doit contenir au moins 6 caractères." };

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return { error: "Un compte avec cet email existe déjà." };

  const expiry = new Date(new Date().getFullYear() + 1, 5, 30);

  await prisma.user.create({
    data: {
      name,
      email,
      password: bcrypt.hashSync(password, 10),
      role,
      position,
      company: admin.activeCompany,
      managerId: role === "EMPLOYEE" ? managerId : null,
      // Force the user to replace the admin-set password on first login.
      mustChangePassword: true,
      // No opening stock: CP is earned only by accrual. The anchor sits one
      // month back so the hire month itself is credited its full 1,5 on the
      // first read, whatever day of the month the employee started.
      leaveBalance: {
        create: { cpDays: 0, rttDays: 10, expiryDate: expiry, lastAccrualAt: initialAccrualAnchor(new Date()) },
      },
    },
  });

  revalidatePath("/admin");
  return { success: true };
}

/**
 * Emails the employee a one-time link to set a new password themselves.
 * Triggered by an admin/manager when an account holder forgot their password.
 */
export async function sendPasswordReset(formData: FormData) {
  const admin = await requireManager();
  const id = formData.get("id") as string;
  if (!id) return { error: "ID manquant." };

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target || target.company !== admin.activeCompany) return { error: "Accès refusé." };
  if (target.role === "ADMIN") return { error: "Les comptes admin ne peuvent pas être réinitialisés ici." };

  if (!isMailConfigured())
    return { error: "L'envoi d'emails n'est pas configuré (variables SMTP_* manquantes)." };

  // One active link per user: drop any earlier unused tokens.
  await prisma.passwordResetToken.deleteMany({ where: { userId: target.id, usedAt: null } });

  const { raw, hash } = generateResetToken();
  await prisma.passwordResetToken.create({
    data: { tokenHash: hash, userId: target.id, expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
  });

  const base = process.env.AUTH_URL ?? "http://localhost:3000";
  const link = `${base.replace(/\/$/, "")}/reset-password?token=${raw}`;

  try {
    await sendPasswordResetEmail(target.email, target.name, link);
  } catch (e) {
    // Don't leave an orphan token if the email failed to send.
    await prisma.passwordResetToken.deleteMany({ where: { userId: target.id, usedAt: null } });
    console.error("sendPasswordReset:", e);
    return { error: "Échec de l'envoi de l'email. Vérifiez la configuration SMTP." };
  }

  return { success: true, email: target.email };
}

export async function deleteEmployee(formData: FormData) {
  const admin = await requireManager();
  const id = formData.get("id") as string;
  if (!id) return { error: "ID manquant." };
  if (id === admin.id) return { error: "Vous ne pouvez pas supprimer votre propre compte." };

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return { error: "Utilisateur introuvable." };
  if (user.company !== admin.activeCompany) return { error: "Accès refusé." };
  if (user.role === "ADMIN") return { error: "Les comptes admin ne peuvent pas être supprimés depuis cette interface." };

  await prisma.user.delete({ where: { id } });
  revalidatePath("/admin");
  return { success: true };
}

export async function updateLeaveBalance(formData: FormData) {
  const admin = await requireManager();
  const userId = formData.get("userId") as string;
  const cpDays = parseFloat(formData.get("cpDays") as string);
  const rttDays = parseFloat(formData.get("rttDays") as string);

  if (!userId || isNaN(cpDays) || isNaN(rttDays)) return { error: "Données invalides." };

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.company !== admin.activeCompany) return { error: "Accès refusé." };

  // Settle any months owed first: the figures below are absolute, so the admin
  // must be overwriting an up-to-date solde rather than a stale one — and the
  // accrual anchor moves to this month, so no back-credit lands on top after.
  await accrueLeaveBalance(userId);

  const expiry = new Date(new Date().getFullYear() + 1, 5, 30);
  await prisma.leaveBalance.upsert({
    where: { userId },
    create: { userId, cpDays, rttDays, expiryDate: expiry, lastAccrualAt: startOfMonth(new Date()) },
    update: { cpDays, rttDays },
  });

  revalidatePath("/admin");
  return { success: true };
}

export async function publishNews(formData: FormData) {
  const admin = await requireManager();
  const content = (formData.get("content") as string)?.trim();
  if (!content) return { error: "Le contenu ne peut pas être vide." };

  await prisma.news.create({ data: { content, publishedById: admin.id, company: admin.activeCompany } });
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return { success: true };
}

/** Turn a company name into a stable uppercase alphanumeric code. */
function toCompanyCode(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 20);
  return base || "ENTREPRISE";
}

export async function createCompany(formData: FormData) {
  await requireManager();

  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "Le nom est obligatoire." };

  // Auto-generate a unique code from the name.
  const base = toCompanyCode(name);
  let code = base;
  for (let n = 2; await prisma.company.count({ where: { code } }); n++) code = `${base}${n}`;

  // Optional logo image.
  let logoPath: string | null = null;
  const file = formData.get("logo");
  if (file instanceof File && file.size > 0) {
    if (!file.type.startsWith("image/")) return { error: "Le logo doit être une image." };
    if (file.size > 2 * 1024 * 1024) return { error: "Le logo ne doit pas dépasser 2 Mo." };
    const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const dir = path.join(process.cwd(), "uploads", "companies");
    await mkdir(dir, { recursive: true });
    logoPath = `${code}-${Date.now()}.${ext}`;
    await writeFile(path.join(dir, logoPath), Buffer.from(await file.arrayBuffer()));
  }

  await prisma.company.create({ data: { code, name, logoPath } });

  revalidatePath("/admin");
  revalidatePath("/select-company");
  return { success: true, code };
}

export async function updateCompany(formData: FormData) {
  await requireManager();

  const code = (formData.get("code") as string)?.trim();
  const name = (formData.get("name") as string)?.trim();
  if (!code || !name) return { error: "Le nom est obligatoire." };

  const company = await prisma.company.findUnique({ where: { code } });
  if (!company) return { error: "Entreprise introuvable." };

  // Optional new logo (code is immutable — users/data reference it).
  let logoPath = company.logoPath;
  const file = formData.get("logo");
  if (file instanceof File && file.size > 0) {
    if (!file.type.startsWith("image/")) return { error: "Le logo doit être une image." };
    if (file.size > 2 * 1024 * 1024) return { error: "Le logo ne doit pas dépasser 2 Mo." };
    const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const dir = path.join(process.cwd(), "uploads", "companies");
    await mkdir(dir, { recursive: true });
    logoPath = `${code}-${Date.now()}.${ext}`;
    await writeFile(path.join(dir, logoPath), Buffer.from(await file.arrayBuffer()));
  }

  await prisma.company.update({ where: { code }, data: { name, logoPath } });

  revalidatePath("/admin");
  revalidatePath("/select-company");
  return { success: true };
}

export async function deleteCompany(formData: FormData) {
  const admin = await requireManager();
  const code = (formData.get("code") as string)?.trim();
  if (!code) return { error: "Code manquant." };

  const total = await prisma.company.count();
  if (total <= 1) return { error: "Impossible de supprimer la dernière entreprise." };

  // Refuse to orphan data: block deletion while accounts are still attached.
  const attached = await prisma.user.count({ where: { company: code } });
  if (attached > 0)
    return { error: `Impossible : ${attached} compte(s) sont rattaché(s) à cette entreprise.` };

  const company = await prisma.company.findUnique({ where: { code } });
  if (!company) return { error: "Entreprise introuvable." };

  await prisma.company.delete({ where: { code } });

  // Best-effort logo cleanup.
  if (company.logoPath) {
    await rm(path.join(process.cwd(), "uploads", "companies", company.logoPath)).catch(() => {});
  }

  // If the admin was viewing the deleted company, drop back to their own.
  if (admin.activeCompany === code) {
    const cookieStore = await cookies();
    cookieStore.delete("active_company");
  }

  revalidatePath("/admin");
  revalidatePath("/select-company");
  return { success: true };
}

export async function deleteNews(formData: FormData) {
  const admin = await requireManager();
  const id = formData.get("id") as string;
  if (!id) return { error: "ID manquant." };

  const news = await prisma.news.findUnique({ where: { id } });
  if (!news || news.company !== admin.activeCompany) return { error: "Accès refusé." };

  await prisma.news.delete({ where: { id } });
  revalidatePath("/dashboard");
  return { success: true };
}
