"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { companyExists } from "@/lib/company";

export async function selectCompanyAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { role } = session.user;
  if (role !== "MANAGER" && role !== "ADMIN") redirect("/dashboard");

  const company = formData.get("company") as string;
  if (!(await companyExists(company))) redirect("/select-company");

  const cookieStore = await cookies();
  cookieStore.set("active_company", company, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    maxAge: 60 * 60 * 8,
  });

  redirect("/dashboard");
}
