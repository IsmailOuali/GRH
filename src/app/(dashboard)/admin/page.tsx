import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCompany, listCompanies } from "@/lib/company";
import { AdminTabs } from "./AdminForms";
import { accrueCompanyLeaveBalances } from "@/lib/accrual";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "MANAGER"))
    redirect("/dashboard");

  const company = await getActiveCompany(session.user.role, session.user.company);

  // RH opening this page settles the monthly CP accrual for the whole company —
  // employees who never sign in still get their 1,5 jour credited each month.
  await accrueCompanyLeaveBalances(company);

  const users = await prisma.user.findMany({
    where: { company },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true, position: true },
  });

  const managers = users.filter((u) => u.role === "MANAGER" || u.role === "SUPERVISEUR");
  const companies = await listCompanies();

  return (
    <div>
      <h1 className="mb-6 hidden text-xl font-semibold text-slate-900 md:block">Administration</h1>
      <AdminTabs users={users} managers={managers} companies={companies} />
    </div>
  );
}
