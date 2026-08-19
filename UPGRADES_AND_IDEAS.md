# Fair'Up OS — Possible Upgrades & Ideas

_Ideas to grow the HR portal, roughly ordered by value-for-effort within each group._
Effort scale: 🟢 small · 🟡 medium · 🔴 large.

---

## A. Finish / harden what already exists

### A1. Payslip amounts & payslip detail 🟡
The DB already carried `grossAmount` / `deductions` / `netAmount` (now orphaned — see ERRORS #2). Restore them so a payslip shows gross/net/déductions, not just a PDF link. Adds a real "Paie" summary and enables the charts in D2.

### A2. Company management: edit / delete / branding 🟢🟡
Creation now exists. Add:
- Edit name / tagline / replace logo.
- Delete (guard: block if users/data reference the company).
- Show each company's user count.
- **Assign a company directly in the "Nouveau compte" form** (a dropdown), so you don't have to switch espace first.

### A3. More dossier fields + per-company templates 🟡
The intake form varies per company (FAIRUP vs FAIR2UP wording/tools already differ). Consider:
- Store the source-form "variant" on the dossier.
- Make `parseLabels` / `PIECE_DOCUMENTS` / outils options configurable per company.
- Capture any remaining fields the forms carry (already added CIN/CNSS).

### A4. Ticket workflow 🟡
Tickets are create + status only. Add assignment (to an HR/manager), a comment thread, and email/in-app notification on status change. Turn "Demandes Admin" into a light helpdesk.

### A5. Leave engine polish 🟡
- Show a **team absence calendar** (month view) instead of only "who's out today".
- Prevent overlapping requests; warn on team coverage.
- Re-credit balance if an approved leave is later cancelled/deleted (today deduction is one-way).
- Carry-over / accrual rules per company.

---

## B. New features with high user value

### B1. Notifications 🟡🔴
In-app bell + optional email for: leave approved/refused, document ready, new payslip, ticket update, dossier assigned. Biggest perceived-quality jump. (Email needs an SMTP/Resend integration.)

### B2. Employee self-service profile 🟢
Let a user view their own info (from the linked dossier), change their password, and update a phone/emergency contact — reducing HR tickets.

### B3. Documents from the dossier 🟡
The dossier already holds name, poste, CIN, CNSS, dates. Auto-fill the **Attestation de Travail / Attestation de Salaire** templates from a linked dossier in one click (they share fields like `numero_cin`, `numero_cnss`, `intitule_poste`).

### B4. Onboarding checklist 🟢
Turn the dossier "Pièces Justificatives" into an onboarding tracker: which docs are received/missing per new hire, with a completion %.

### B5. Reporting & exports 🟡
CSV/PDF export of leave history, headcount, ticket volumes, payroll totals — per company and date range.

### B6. Org structure 🟡
Real Department/Service entities (currently a free-text string on the dossier) → enables filtering, department managers, and headcount by department.

---

## C. Platform / architecture

### C1. Automated tests 🟡
- The PDF parser (`src/lib/dossiers/extract.ts`) is already pure and was validated ad-hoc — lock it in with **Vitest** unit tests (both form variants as fixtures).
- **Playwright** e2e for the critical flows (login, leave request→approve, dossier upload→regenerate, company create). Playwright is already a dependency.

### C2. CI pipeline 🟢
GitHub Actions running `tsc --noEmit`, `eslint`, and `next build` on PRs — would have caught the current build-breaking errors.

### C3. Production file storage 🟡
`uploads/` on local disk won't survive most deployments (serverless/containers are ephemeral). Move payslips/dossiers/logos to S3-compatible blob storage or a persistent volume; serve via signed URLs.

### C4. Database for production 🟡
SQLite is great for dev but move to Postgres for production (multi-instance, backups). Prisma makes this a datasource + connection-string change plus a migration re-baseline.

### C5. Structured audit log 🟡
Record who created/edited/deleted dossiers, users, companies, and who approved leave — important for a "STRICTEMENT CONFIDENTIEL" HR system.

---

## D. UX & polish

### D1. Search, filter & pagination 🟡
Every table loads all rows. Add server-side pagination + search (employees, tickets, payslips, dossiers, team history) before data grows.

### D2. Dashboard analytics 🟡
Manager/admin KPIs: headcount, pending validations, tickets by status, leave taken vs balance, upcoming absences — small charts.

### D3. Company logo in generated PDFs 🟢
Put the active company's logo at the top of the regenerated dossier and the attestation documents.

### D4. Dark mode 🟢
Tailwind v4 makes this cheap; HR users often want it.

### D5. Accessibility pass 🟢
Keyboard support for the mobile row popup (`TappableRow`), focus management in the bottom sheet, aria labels on icon-only buttons.

---

## E. Regional fit (Morocco)

### E1. Arabic / bilingual UI 🔴
The app is French-only; Morocco is bilingual. Add i18n (fr/ar) with RTL support — a strong differentiator.

### E2. CNSS / local payroll specifics 🟡
CNSS number is now captured — build on it: CNSS declarations, AMO, IR brackets, local leave law (jours ouvrables vs ouvrés is already handled) and Moroccan public-holiday calendar for leave calculations.

---

## F. Security & compliance

### F1. Auth hardening 🟡
Password reset flow, configurable password policy, optional 2FA, session revocation, and rate limiting on `/api/auth` + upload routes.

### F2. Least-privilege review 🟡
Now that managers share the admin surface, re-audit each admin action (e.g. should a manager be able to create other managers, or delete accounts?). Consider a finer permission model than the 3 flat roles.

### F3. Data retention & GDPR-style controls 🟡
Given the confidential HR data, add: export "all data for employee X", delete-on-offboarding, and encryption-at-rest for `uploads/`.

---

## Suggested near-term roadmap

1. **Stabilize:** fix build errors, schema drift, branding regression, download scoping (see ERRORS_AND_FIXES.md), add CI + parser tests.
2. **Delight:** notifications (B1) + employee self-service (B2) + dossier→attestation autofill (B3).
3. **Scale:** pagination/search (D1), blob storage (C3), Postgres (C4), audit log (C5).
4. **Differentiate:** Arabic/RTL (E1) + Morocco payroll specifics (E2).
