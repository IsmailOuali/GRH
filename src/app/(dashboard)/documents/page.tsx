import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCompany } from "@/lib/company";
import { toIso } from "@/lib/dates";
import { DocumentForm } from "@/components/DocumentForm";
import { DocRequestHistory } from "@/components/DocRequestHistory";
import { DocRequestQueue } from "@/components/DocRequestQueue";
import { LegalisationQueue } from "@/components/LegalisationQueue";
import { Tabs } from "@/components/Tabs";
import { Card, CardBody } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function DocumentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { role } = session.user;
  const isManager = role === "MANAGER" || role === "ADMIN";
  const company = await getActiveCompany(role, session.user.company);

  const employees = await prisma.user.findMany({
    where: { role: "EMPLOYEE", company },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const dynamicData = { employees: employees.map((e) => e.name) };
  const sessionUser = { id: session.user.id, name: session.user.name ?? "", role };
  // Resolved server-side so the pre-filled date fields don't differ between
  // SSR and hydration (see DocumentForm's `today` prop).
  const today = toIso(new Date());

  // ── Employee view ──────────────────────────────────────────────────────────
  if (!isManager) {
    const myRequestsRaw = await prisma.documentRequest.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });
    // Never ship the stored scan filename to the client — only whether one exists.
    const myRequests = myRequestsRaw.map(({ legaliseFile, ...r }) => ({
      ...r,
      hasLegaliseFile: Boolean(legaliseFile),
    }));

    const requestForm = (
      <Card>
        <CardBody>
          <DocumentForm dynamicData={dynamicData} sessionUser={sessionUser} mode="request" today={today} />
        </CardBody>
      </Card>
    );

    const historyCard = (
      <Card>
        <DocRequestHistory requests={myRequests} />
      </Card>
    );

    return (
      <div>
        <PageHeader title="Documents" />
        <Tabs
          defaultKey="nouvelle"
          tabs={[
            { key: "nouvelle", label: "Nouvelle demande", content: requestForm },
            { key: "mes-demandes", label: "Mes demandes", content: historyCard },
          ]}
        />
      </div>
    );
  }

  // ── Manager / Admin view ───────────────────────────────────────────────────
  const pendingRequests = await prisma.documentRequest.findMany({
    where: { status: "PENDING", user: { company } },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });

  // Approved requests whose légalisée copy is still to be delivered.
  const toLegalise = await prisma.documentRequest.findMany({
    where: { status: "APPROVED", legalise: true, legaliseAt: null, user: { company } },
    include: { user: { select: { name: true } } },
    orderBy: { reviewedAt: "asc" },
  });

  const queueCard = (
    <Card>
      <DocRequestQueue requests={pendingRequests} />
    </Card>
  );

  const legaliseCard = (
    <Card>
      <LegalisationQueue requests={toLegalise} />
    </Card>
  );

  const generateForm = (
    <Card>
      <CardBody>
        <DocumentForm dynamicData={dynamicData} sessionUser={sessionUser} mode="generate" employees={employees} today={today} />
      </CardBody>
    </Card>
  );

  return (
    <div>
      <PageHeader title="Documents" />
      <Tabs
        defaultKey="attente"
        tabs={[
          { key: "attente", label: "Demandes en attente", badge: pendingRequests.length, content: queueCard },
          { key: "legaliser", label: "À légaliser", badge: toLegalise.length, content: legaliseCard },
          { key: "generation", label: "Génération directe", content: generateForm },
        ]}
      />
    </div>
  );
}
