import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const EXPIRY = new Date(new Date().getFullYear() + 1, 5, 30); // June 30 next year

async function main() {
  // ── Users ────────────────────────────────────────────────────────────────
  const admin = await prisma.user.create({
    data: {
      id: "u-admin",
      name: "Hakim",
      email: "admin@fairup.fr",
      password: bcrypt.hashSync("admin123", 10),
      role: "ADMIN",
      position: "Directrice RH",
      hireDate: new Date("2018-03-01"),
    },
  });

  const mgr1 = await prisma.user.create({
    data: {
      id: "u-mgr-1",
      name: "Kabil",
      email: "manager1@fairup.fr",
      password: bcrypt.hashSync("manager123", 10),
      role: "MANAGER",
      position: "Responsable équipe A",
      hireDate: new Date("2019-07-15"),
    },
  });

  const mgr2 = await prisma.user.create({
    data: {
      id: "u-mgr-2",
      name: "Claire Bernard",
      email: "manager2@fairup.fr",
      password: bcrypt.hashSync("manager123", 10),
      role: "MANAGER",
      position: "Responsable équipe B",
      hireDate: new Date("2020-01-10"),
    },
  });

  const emp1 = await prisma.user.create({
    data: {
      id: "u-emp-1",
      name: "Thomas Petit",
      email: "emp1@fairup.fr",
      password: bcrypt.hashSync("emp123", 10),
      role: "EMPLOYEE",
      position: "Développeur",
      hireDate: new Date("2021-09-01"),
      managerId: mgr1.id,
    },
  });

  const emp2 = await prisma.user.create({
    data: {
      id: "u-emp-2",
      name: "Marie Lambert",
      email: "emp2@fairup.fr",
      password: bcrypt.hashSync("emp123", 10),
      role: "EMPLOYEE",
      position: "Comptable",
      hireDate: new Date("2022-02-14"),
      managerId: mgr1.id,
    },
  });

  const emp3 = await prisma.user.create({
    data: {
      id: "u-emp-3",
      name: "Nicolas Roux",
      email: "emp3@fairup.fr",
      password: bcrypt.hashSync("emp123", 10),
      role: "EMPLOYEE",
      position: "Commercial",
      hireDate: new Date("2022-06-01"),
      managerId: mgr2.id,
    },
  });

  // ── Leave balances ────────────────────────────────────────────────────────
  for (const user of [emp1, emp2, emp3, mgr1, mgr2, admin]) {
    await prisma.leaveBalance.create({
      data: { userId: user.id, cpDays: 25, rttDays: 10, expiryDate: EXPIRY },
    });
  }

  // ── Leave requests ────────────────────────────────────────────────────────
  await prisma.leaveRequest.create({
    data: {
      userId: emp1.id,
      type: "CP",
      startDate: new Date("2026-07-14"),
      endDate: new Date("2026-07-18"),
      days: 5,
      comment: "Vacances d'été",
      status: "PENDING",
    },
  });

  await prisma.leaveRequest.create({
    data: {
      userId: emp1.id,
      type: "RTT",
      startDate: new Date("2026-06-02"),
      endDate: new Date("2026-06-02"),
      days: 1,
      status: "APPROVED",
      reviewedById: mgr1.id,
      reviewedAt: new Date("2026-05-28"),
    },
  });

  await prisma.leaveRequest.create({
    data: {
      userId: emp2.id,
      type: "CP",
      startDate: new Date("2026-08-04"),
      endDate: new Date("2026-08-15"),
      days: 10,
      comment: "Congés annuels",
      status: "PENDING",
    },
  });

  await prisma.leaveRequest.create({
    data: {
      userId: emp3.id,
      type: "MALADIE",
      startDate: new Date("2026-05-20"),
      endDate: new Date("2026-05-22"),
      days: 3,
      status: "APPROVED",
      reviewedById: mgr2.id,
      reviewedAt: new Date("2026-05-19"),
    },
  });

  // ── Payslips ──────────────────────────────────────────────────────────────
  const payslipData = [
    { userId: emp1.id, month: "Avril 2026", gross: 3200, ded: 640 },
    { userId: emp1.id, month: "Mai 2026",   gross: 3200, ded: 640 },
    { userId: emp2.id, month: "Avril 2026", gross: 2800, ded: 560 },
    { userId: emp2.id, month: "Mai 2026",   gross: 2800, ded: 560 },
    { userId: emp3.id, month: "Avril 2026", gross: 2600, ded: 520 },
    { userId: emp3.id, month: "Mai 2026",   gross: 2600, ded: 520 },
    { userId: mgr1.id, month: "Avril 2026", gross: 4500, ded: 900 },
    { userId: mgr1.id, month: "Mai 2026",   gross: 4500, ded: 900 },
    { userId: mgr2.id, month: "Avril 2026", gross: 4200, ded: 840 },
    { userId: mgr2.id, month: "Mai 2026",   gross: 4200, ded: 840 },
    { userId: admin.id, month: "Avril 2026", gross: 5500, ded: 1100 },
    { userId: admin.id, month: "Mai 2026",   gross: 5500, ded: 1100 },
  ];

  for (const p of payslipData) {
    await prisma.payslip.create({
      data: {
        userId: p.userId,
        month: p.month,
      },
    });
  }

  // ── Tickets ───────────────────────────────────────────────────────────────
  await prisma.ticket.create({
    data: { userId: emp1.id, category: "RH", description: "Demande d'attestation de travail pour la banque.", status: "RESOLVED" },
  });
  await prisma.ticket.create({
    data: { userId: emp1.id, category: "IT", description: "Mon accès VPN ne fonctionne plus depuis lundi.", status: "IN_PROGRESS" },
  });
  await prisma.ticket.create({
    data: { userId: emp2.id, category: "PAIE", description: "Erreur sur mon bulletin d'avril — prime non incluse.", status: "OPEN" },
  });
  await prisma.ticket.create({
    data: { userId: emp3.id, category: "RH", description: "Besoin d'une copie de mon contrat de travail.", status: "OPEN" },
  });
  await prisma.ticket.create({
    data: { userId: emp2.id, category: "AUTRE", description: "Question sur la mutuelle d'entreprise.", status: "RESOLVED" },
  });

  // ── News ─────────────────────────────────────────────────────────────────
  await prisma.news.create({
    data: {
      content: "🎉 Bienvenue sur Fair'Up OS, votre nouveau portail RH ! Retrouvez ici vos bulletins de paie, demandes de congés et tickets administratifs.",
      publishedById: admin.id,
      createdAt: new Date("2026-06-01"),
    },
  });
  await prisma.news.create({
    data: {
      content: "📅 Rappel : les demandes de congés pour juillet doivent être soumises avant le 15 juin. Merci de planifier avec vos responsables.",
      publishedById: admin.id,
      createdAt: new Date("2026-06-03"),
    },
  });

  console.log("✅ Seed terminé — base de données peuplée.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
