import { redirect } from "next/navigation";
import { format } from "date-fns";
import { IdCard } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCompany } from "@/lib/company";
import { formatFrIso } from "@/lib/dates";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { Tabs } from "@/components/Tabs";
import { Card, CardBody } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  SITUATION_FAMILIALE_OPTIONS,
  TYPE_CONTRAT_OPTIONS,
  type SelectOption,
} from "@/lib/dossiers/schema";
import { dossierToData } from "@/lib/dossiers/serialize";
import { CHANGE_TOPICS, getTopic, maskRib, TOPIC_LABELS, topicFields } from "@/lib/profile-changes";
import { ChangeForm } from "./ChangeForm";
import { CancelChangeButton, ReviewChangeButtons } from "./ChangeActions";
import { PieceUpload } from "./PieceUpload";

const dash = "—";

function optionLabel(options: SelectOption[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

function parseValues(json: string): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(json);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** How a column value reads on screen (RIB masked, codes turned into labels). */
function display(column: string, value: string | undefined): string {
  const v = (value ?? "").trim();
  if (!v) return dash;
  if (column === "rib") return maskRib(v) || dash;
  if (column === "situationFamiliale") return optionLabel(SITUATION_FAMILIALE_OPTIONS, v);
  return v;
}

function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="divide-y divide-slate-100">
      {rows.map(([label, value]) => (
        <div key={label} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5">
          <dt className="text-sm text-slate-500">{label}</dt>
          <dd className="min-w-0 break-words text-right text-sm font-medium text-slate-900">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Section({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <Card>
      <CardBody>
        <h2 className="mb-1 text-[0.9375rem] font-semibold tracking-tight text-slate-900">{title}</h2>
        <Rows rows={rows} />
      </CardBody>
    </Card>
  );
}

/** "Ancienne valeur → nouvelle valeur" for each column of a request. */
function Diff({ topicValue, previous, next }: { topicValue: string; previous: string; next: string }) {
  const topic = getTopic(topicValue);
  const before = parseValues(previous);
  const after = parseValues(next);
  return (
    <ul className="space-y-1 text-sm">
      {(topic ? topicFields(topic) : []).map((f) => (
        <li key={f.name} className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-slate-500">{f.label} :</span>
          <span className="text-slate-500 line-through decoration-slate-300">{display(f.name, before[f.name])}</span>
          <span aria-hidden>→</span>
          <span className="font-medium text-slate-900">{display(f.name, after[f.name])}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function MesInformationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = session.user.id;
  const role = session.user.role;
  const isHr = role === "MANAGER" || role === "ADMIN";
  const company = await getActiveCompany(role, session.user.company);

  const [user, dossierRow, myChanges] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, manager: { select: { name: true } } },
    }),
    prisma.employeeDossier.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" } }),
    prisma.profileChangeRequest.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
  ]);

  const noFiche = (
    <Card>
      <EmptyState
        icon={IdCard}
        title="Votre fiche n'a pas encore été créée"
        description="Les RH doivent d'abord créer votre dossier et le relier à votre compte."
      />
    </Card>
  );

  // ── The salarié's own fiche ────────────────────────────────────────────────
  let ficheTab: React.ReactNode = noFiche;
  let changeTab: React.ReactNode = noFiche;
  let piecesTab: React.ReactNode = noFiche;

  if (dossierRow) {
    const data = dossierToData(dossierRow as unknown as Record<string, unknown>);
    const f = data.fields;
    const date = (iso: string) => (iso ? formatFrIso(iso) : dash);
    const text = (v: string | undefined) => (v && v.trim() ? v.trim() : dash);
    const fullName = [f.prenom, f.nom].filter(Boolean).join(" ") || user?.name || dash;

    ficheTab = (
      <div className="grid gap-5 lg:grid-cols-2">
        <Section
          title="Situation professionnelle"
          rows={[
            ["Poste", text(f.poste)],
            ["Type de contrat", f.typeContrat ? optionLabel(TYPE_CONTRAT_OPTIONS, f.typeContrat) : dash],
            ["Date d'entrée", date(f.dateIntegration)],
            ["Manager", user?.manager?.name ?? text(f.manager)],
            ["Matricule", text(f.matricule)],
            ["Département", text(f.departement)],
            ["Email professionnel", text(f.emailPro)],
          ]}
        />
        <Section
          title="Informations personnelles"
          rows={[
            ["Nom", fullName],
            ["Date de naissance", date(f.dateNaissance)],
            ["Nationalité", text(f.nationalite)],
            ["CIN", text(f.numeroCin)],
            ["CNSS", text(f.numeroCnss)],
            ["Adresse", text(f.adresseResidentielle)],
            ["Téléphone", text(f.telephonePersonnel)],
            ["Email personnel", text(f.emailPersonnel)],
            ["Situation familiale", display("situationFamiliale", f.situationFamiliale)],
            ["Nombre d'enfants", text(f.nombreEnfants)],
            ["RIB", display("rib", f.rib)],
          ]}
        />
        <Section
          title="Contact d'urgence"
          rows={[
            ["Nom et prénom", text(f.contactUrgenceNom)],
            ["Lien de parenté", text(f.contactUrgenceLien)],
            ["Téléphone", text(f.contactUrgenceTelephone)],
          ]}
        />
        <p className="self-start rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 ring-1 ring-inset ring-slate-200/70">
          Une information est inexacte ? Utilisez l&apos;onglet « Demander un changement » pour l&apos;adresse, le
          téléphone, la situation familiale, le RIB ou le contact d&apos;urgence. Pour le reste (poste, contrat,
          date d&apos;entrée…), contactez les RH.
        </p>
      </div>
    );

    // ── Demander un changement ───────────────────────────────────────────────
    const pendingTopics = myChanges.filter((c) => c.status === "PENDING").map((c) => c.topic);
    changeTab = (
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardBody>
            <p className="mb-4 text-sm text-slate-600">
              Les RH valident votre demande avant de mettre votre fiche à jour.
            </p>
            <ChangeForm current={f} pendingTopics={pendingTopics} />
          </CardBody>
        </Card>

        <Card>
          {myChanges.length === 0 ? (
            <EmptyState
              icon={IdCard}
              title="Aucune demande"
              description="Vos demandes de modification et leur suivi apparaîtront ici."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {myChanges.map((c) => (
                <li key={c.id} className="space-y-2 px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-slate-900">
                      {TOPIC_LABELS[c.topic] ?? c.topic}
                      <span className="ml-2 text-xs font-normal text-slate-500">
                        {format(c.createdAt, "dd/MM/yyyy")}
                      </span>
                    </p>
                    <StatusBadge status={c.status} label={c.status === "APPROVED" ? "Validé" : undefined} />
                  </div>
                  <Diff topicValue={c.topic} previous={c.previousValues} next={c.newValues} />
                  {c.status === "REJECTED" && c.reviewNote && (
                    <p className="text-xs italic text-slate-500">Motif du refus : {c.reviewNote}</p>
                  )}
                  {c.status === "PENDING" && <CancelChangeButton id={c.id} />}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    );

    // ── Mes pièces ───────────────────────────────────────────────────────────
    const waiting = data.pieces.filter((p) => p.statut === "En attente").length;
    piecesTab = (
      <Card>
        <div className="border-b border-slate-100 px-5 py-4 text-sm text-slate-600">
          {waiting > 0
            ? `${waiting} pièce${waiting > 1 ? "s" : ""} attendue${waiting > 1 ? "s" : ""} par les RH. Déposez un PDF ou une image (15 Mo max) ; le fichier est rangé dans votre coffre-fort.`
            : "Toutes les pièces demandées ont été reçues."}
        </div>
        <ul className="divide-y divide-slate-100">
          {data.pieces.map((p) => (
            <li key={p.document} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">{p.document}</p>
                {p.statut === "Reçu" && p.dateReception && (
                  <p className="text-xs text-slate-500">Reçue le {formatFrIso(p.dateReception)}</p>
                )}
              </div>
              {p.statut === "Reçu" ? (
                <StatusBadge status="APPROVED" label="Reçue" />
              ) : (
                <div className="flex items-center gap-3">
                  <StatusBadge status="PENDING" label="En attente" />
                  <PieceUpload piece={p.document} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>
    );
  }

  // ── RH: modifications to validate (company-wide) ───────────────────────────
  if (!isHr) {
    return (
      <div>
        <PageHeader title="Mes informations" description="Votre fiche, vos demandes de modification et vos pièces." />
        <Tabs
          defaultKey="fiche"
          tabs={[
            { key: "fiche", label: "Ma fiche", content: ficheTab },
            { key: "changement", label: "Demander un changement", content: changeTab },
            { key: "pieces", label: "Mes pièces", content: piecesTab },
          ]}
        />
      </div>
    );
  }

  const pending = await prisma.profileChangeRequest.findMany({
    where: { status: "PENDING", user: { company } },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "asc" }, // longest-waiting first
  });

  const reviewTab = (
    <Card>
      {pending.length === 0 ? (
        <EmptyState
          icon={IdCard}
          title="Tout est à jour"
          description="Aucune modification de fiche en attente de validation."
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {pending.map((c) => (
            <li key={c.id} className="space-y-3 px-5 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium text-slate-900">
                  {c.user.name}
                  <span className="ml-2 text-sm font-normal text-slate-500">
                    · {TOPIC_LABELS[c.topic] ?? c.topic}
                  </span>
                </p>
                <span className="text-xs text-slate-500">{format(c.createdAt, "dd/MM/yyyy")}</span>
              </div>
              <Diff topicValue={c.topic} previous={c.previousValues} next={c.newValues} />
              {c.comment && <p className="text-xs italic text-slate-500">« {c.comment} »</p>}
              <ReviewChangeButtons
                id={c.id}
                disabledReason={
                  c.userId === userId
                    ? "C'est votre propre demande : un autre responsable doit la valider."
                    : undefined
                }
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );

  return (
    <div>
      <PageHeader title="Mes informations" description="Votre fiche, et les modifications de fiche à valider." />
      <Tabs
        defaultKey="valider"
        tabs={[
          { key: "valider", label: "À valider", badge: pending.length, content: reviewTab },
          { key: "fiche", label: "Ma fiche", content: ficheTab },
          { key: "changement", label: "Demander un changement", content: changeTab },
          { key: "pieces", label: "Mes pièces", content: piecesTab },
        ]}
      />
    </div>
  );
}
