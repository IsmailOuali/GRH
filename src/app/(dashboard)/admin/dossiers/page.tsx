import { redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { FolderOpen, Pencil, Download } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCompany } from "@/lib/company";
import { canManageDossiers, dossierListWhere } from "@/lib/dossiers/access";
import { EmptyState } from "@/components/EmptyState";
import { TappableRow } from "@/components/TappableRow";
import { DossierUploader } from "@/components/DossierUploader";
import { DossierDeleteButton } from "@/components/DossierDeleteButton";

export default async function DossiersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!canManageDossiers(session.user.role)) redirect("/dashboard");

  const company = await getActiveCompany(session.user.role, session.user.company);

  const dossiers = await prisma.employeeDossier.findMany({
    where: dossierListWhere({ role: session.user.role, userId: session.user.id, company }),
    orderBy: { updatedAt: "desc" },
    include: { user: { select: { name: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        {/* The mobile top bar already shows the section title — avoid repeating it. */}
        <h1 className="hidden text-xl font-semibold text-slate-900 md:block">Dossiers Salariés</h1>
        <p className="text-sm text-slate-500 md:mt-1">
          Importez un dossier PDF rempli pour en extraire les données, corrigez-les, puis régénérez un PDF propre.
        </p>
      </div>

      <DossierUploader />

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        {dossiers.length === 0 ? (
          <EmptyState icon={FolderOpen} title="Aucun dossier" description="Les dossiers salariés importés apparaîtront ici." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                  <th className="px-5 py-3 font-medium">Salarié</th>
                  <th className="hidden px-5 py-3 font-medium md:table-cell">Matricule</th>
                  <th className="px-5 py-3 font-medium">Poste</th>
                  <th className="hidden px-5 py-3 font-medium md:table-cell">Mis à jour</th>
                  <th className="hidden px-5 py-3 font-medium md:table-cell">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dossiers.map((d) => {
                  const name =
                    [d.prenom, d.nom].filter(Boolean).join(" ") || d.user?.name || "—";
                  const majAt = format(new Date(d.updatedAt), "dd/MM/yyyy");
                  const actions = (
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/dossiers/${d.id}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50/70"
                      >
                        <Pencil className="size-3.5" /> Voir / Éditer
                      </Link>
                      {d.generatedPdfPath ? (
                        <a
                          href={`/api/dossiers/${d.id}/download`}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50/70"
                        >
                          <Download className="size-3.5" /> PDF
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">PDF non généré</span>
                      )}
                      <DossierDeleteButton id={d.id} name={name} />
                    </div>
                  );
                  return (
                    <TappableRow
                      key={d.id}
                      className="hover:bg-slate-50/70"
                      detail={{
                        title: name,
                        items: [
                          { label: "Salarié", value: name },
                          { label: "Matricule", value: d.matricule || "" },
                          { label: "Poste", value: d.poste || "" },
                          { label: "Mis à jour", value: majAt },
                          { label: "Actions", value: actions },
                        ],
                      }}
                    >
                      <td className="px-5 py-4 font-medium text-slate-800">{name}</td>
                      <td className="hidden px-5 py-4 text-slate-600 md:table-cell">{d.matricule || "—"}</td>
                      <td className="px-5 py-4 text-slate-600">{d.poste || "—"}</td>
                      <td className="hidden px-5 py-4 text-slate-500 md:table-cell">{majAt}</td>
                      <td className="hidden px-5 py-4 md:table-cell">{actions}</td>
                    </TappableRow>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
