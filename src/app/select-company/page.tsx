import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Building2 } from "lucide-react";
import { auth } from "@/auth";
import { listCompanies } from "@/lib/company";
import { getCompanyPendingTotals } from "@/lib/notifications";
import { CompanyPicker } from "@/components/CompanyPicker";

export default async function SelectCompanyPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { role, name } = session.user;
  if (role !== "MANAGER" && role !== "ADMIN") redirect("/dashboard");

  const cookieStore = await cookies();
  const current = cookieStore.get("active_company")?.value;
  const companies = await listCompanies();
  const demands = await getCompanyPendingTotals(companies.map((c) => c.code));

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-white shadow-sm">
            <Building2 className="size-7 text-slate-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Choisissez votre espace</h1>
          <p className="mt-2 text-slate-500">
            Connecté en tant que <span className="font-medium text-slate-700">{name}</span>
          </p>
        </div>

        <CompanyPicker companies={companies} current={current} demands={demands} />
      </div>
    </div>
  );
}
