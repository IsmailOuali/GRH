import { redirect } from "next/navigation";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Download, FileText, ShieldCheck, Archive } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCompany } from "@/lib/company";
import { getVaultForUser, CATEGORY_LABELS, type VaultItem } from "@/lib/coffre-fort";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { LinkButton } from "@/components/ui/Button";
import { UploadVaultForm } from "./UploadVaultForm";
import { EmployeePicker } from "./EmployeePicker";
import { VaultDeleteButton } from "./VaultDeleteButton";

const CATEGORY_CHIP: Record<string, string> = {
  BULLETIN: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200",
  CONTRAT: "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200",
  ADMINISTRATIF: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
  JUSTIFICATIF: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
  AUTRE: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-neutral-300",
};

function groupByYear(items: VaultItem[]): [number, VaultItem[]][] {
  const map = new Map<number, VaultItem[]>();
  for (const it of items) {
    const bucket = map.get(it.year) ?? [];
    bucket.push(it);
    map.set(it.year, bucket);
  }
  return [...map.entries()].sort((a, b) => b[0] - a[0]);
}

function VaultList({ items }: { items: VaultItem[] }) {
  if (items.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={FileText}
          title="Coffre-fort vide"
          description="Aucun document pour le moment. Bulletins, contrats et attestations apparaîtront ici."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {groupByYear(items).map(([year, yearItems]) => (
        <Card key={year}>
          <CardHeader title={String(year)}>
            <span className="text-xs font-medium text-slate-400">
              {yearItems.length} document{yearItems.length > 1 ? "s" : ""}
            </span>
          </CardHeader>
          <ul className="divide-y divide-slate-100 dark:divide-white/10">
            {yearItems.map((it) => (
              <li key={it.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                        CATEGORY_CHIP[it.category] ?? CATEGORY_CHIP.AUTRE
                      }`}
                    >
                      {CATEGORY_LABELS[it.category]}
                    </span>
                    <p className="truncate font-medium text-slate-800 dark:text-neutral-100">{it.title}</p>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {format(new Date(it.createdAt), "d MMMM yyyy", { locale: fr })}
                    {it.meta ? ` · ${it.meta}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <LinkButton href={it.downloadUrl} aria-label={`Télécharger ${it.title}`}>
                    <Download className="size-3.5" aria-hidden />
                    Télécharger
                  </LinkButton>
                  {it.deletable && (
                    <VaultDeleteButton id={it.key.replace("vault:", "")} title={it.title} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}

export default async function CoffreFortPage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { role } = session.user;
  const isHr = role === "MANAGER" || role === "ADMIN";

  // ── Employee / Superviseur: their own vault ────────────────────────────────
  if (!isHr) {
    const items = await getVaultForUser(session.user.id);
    return (
      <div className="space-y-6">
        <PageHeader title="Coffre-fort" />
        {items.length > 0 && (
          <div className="flex justify-end">
            <LinkButton href="/api/coffre-fort/download-all" variant="secondary">
              <Archive className="size-3.5" aria-hidden />
              Tout télécharger (ZIP)
            </LinkButton>
          </div>
        )}
        <VaultList items={items} />
      </div>
    );
  }

  // ── HR: pick an employee, then view + manage their vault ───────────────────
  const { userId } = await searchParams;
  const company = await getActiveCompany(role, session.user.company);
  const employees = await prisma.user.findMany({
    where: { role: { not: "ADMIN" }, company },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const selected = userId ? employees.find((e) => e.id === userId) : undefined;
  const items = selected ? await getVaultForUser(selected.id) : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Coffre-fort" />

      <Card>
        <CardBody className="space-y-1">
          <p className="text-sm text-slate-500">
            Consultez et gérez le coffre-fort numérique d&apos;un salarié.
          </p>
          <EmployeePicker employees={employees} selectedId={selected?.id} />
        </CardBody>
      </Card>

      {!selected ? (
        <Card>
          <EmptyState
            icon={ShieldCheck}
            title="Sélectionnez un employé"
            description="Choisissez un salarié pour voir ses documents et en ajouter."
          />
        </Card>
      ) : (
        <>
          <UploadVaultForm employee={selected} />
          {items.length > 0 && (
            <div className="flex justify-end">
              <LinkButton
                href={`/api/coffre-fort/download-all?userId=${selected.id}`}
                variant="secondary"
              >
                <Archive className="size-3.5" aria-hidden />
                Tout télécharger (ZIP)
              </LinkButton>
            </div>
          )}
          <VaultList items={items} />
        </>
      )}
    </div>
  );
}
