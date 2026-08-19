import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCompany } from "@/lib/company";
import { canManageDossiers, canAccessDossier } from "@/lib/dossiers/access";
import { dossierToData } from "@/lib/dossiers/serialize";
import { DossierForm } from "@/components/DossierForm";

export default async function DossierEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!canManageDossiers(session.user.role)) redirect("/dashboard");

  const { id } = await params;
  const company = await getActiveCompany(session.user.role, session.user.company);

  const dossier = await prisma.employeeDossier.findUnique({
    where: { id },
    include: { user: { select: { managerId: true } } },
  });
  if (!dossier) notFound();

  const principal = { role: session.user.role, userId: session.user.id, company };
  if (!canAccessDossier(principal, dossier)) redirect("/admin/dossiers");

  const employees = await prisma.user.findMany({
    where: { company },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });

  const data = dossierToData(dossier);
  const name = [dossier.prenom, dossier.nom].filter(Boolean).join(" ") || "Nouveau dossier";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/admin/dossiers" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft className="size-4" /> Retour aux dossiers
        </Link>
        <h1 className="mt-2 flex items-center gap-2 text-xl font-semibold text-slate-900">
          <FileText className="size-5 text-slate-400" />
          {name}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Vérifiez les champs extraits — ceux marqués <span className="font-medium text-amber-600">non détecté </span> n&apos;ont pas pu être lus automatiquement.
        </p>
      </div>

      <DossierForm
        id={id}
        initialData={data}
        flagEmpties={!!dossier.sourcePdfPath}
        employees={employees}
        linkedUserId={dossier.userId}
      />
    </div>
  );
}
