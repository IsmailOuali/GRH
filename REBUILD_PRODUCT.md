# Fair'Up OS — Product Brief for Rebuild

## What is it?

An internal HR portal (in French) called **Fair'Up OS**. It is a full-stack web app used by employees, managers, and admins of a company to manage leave requests, payslips, administrative tickets, and company documents.

---

## User Roles

Three roles with progressively wider access:

| Role | French label | Access level |
|------|-------------|--------------|
| `EMPLOYEE` | Salarié | Base features only |
| `MANAGER` | Responsable | Base + validations + team stats |
| `ADMIN` | Directeur | Everything + admin panel |

---

## Pages & Features

### `/login`
- Email + password form
- Error message on wrong credentials
- On success → redirect to `/dashboard`
- `autoComplete="email"` and `autoComplete="current-password"` on inputs

---

### `/dashboard` (all roles)
- Greeting: "Bonjour, {name} 👋"
- **Leave balance card** — shows `cpDays` remaining, expiry date. Top border color: indigo-500.
- **Latest payslip card** — month, net amount, "Voir les bulletins →" button. Top border color: indigo-300.
- **Team absences card** — MANAGER/ADMIN only. Count of team members on approved leave today. Top border color: violet-400.
- **News feed card** — company announcements, newest first. Shows publisher name + date.
- Cards use `border-t-4` colored top borders to distinguish KPI cards.

---

### `/conges` — Congés & Absences (all roles)
Two-column layout: form on left, history table on right.

**Leave request form:**
- Type selector: CP (Congés Payés), RTT, Maladie, Sans Solde
- Date range: start date, end date
- Optional comment
- On submit: calculates business days, deducts from balance, saves with status PENDING

**History table columns:** Période | Type | Jours | Statut
- Status badges: PENDING=amber, APPROVED=emerald, REJECTED=red
- Empty state: icon + "Aucune demande" + description

---

### `/paie` — Bulletins de Paie (all roles)
- Table of payslips: Mois | Date de virement | Brut | Net à payer | PDF
- Net amount in indigo-600 bold
- PDF download button → `/api/payslips/[id]/download` (secured: only own payslips or ADMIN)
- If no `pdfPath`: show "Non disponible"
- Empty state: icon + description

---

### `/tickets` — Demandes Administratives (all roles)
Two-column layout: form on left, history table on right.

**Ticket form:**
- Category: RH (attestation, contrat), Paie, Informatique, Autre
- Description textarea
- On submit: creates ticket, shows generated ticket ID via toast

**History table columns:** ID (mono font, first 8 chars) | Catégorie | Date | Statut
- Status badges: OPEN=blue, IN_PROGRESS=amber, RESOLVED=emerald
- Empty state: icon + description

---

### `/validations` — Validations (MANAGER + ADMIN only)
- Table of all PENDING leave requests
- MANAGER sees only their team (users where `managerId = currentUser.id`)
- ADMIN sees all pending
- Columns: Salarié | Type | Période | Jours | Actions
- Actions: "Valider" button (green) + "Refuser" button (red) with optional reject reason
- Badge showing count of pending items in card header
- Empty state: "Tout est à jour" with CheckSquare icon

---

### `/documents` — Génération de Documents (MANAGER + ADMIN only)
- Generate 3 PDF document types:
  1. **Attestation de Congé** — fields: employee name, leave type, start/end date, days, manager name, company name, city, document date
  2. **Attestation de Travail** — fields: employee name, position, hire date, contract type, director name, company, city, date
  3. **Bulletin de Paie** — fields: gross salary, social contributions, CSG/CRDS, income tax, net salary, employee name, month, company

- Step 1: Pick document type (selector or cards)
- Step 2: Fill in the form for that type
- On generate: POST to `/api/documents/generate` → returns PDF as download

---

### `/admin` — Administration (ADMIN only)
Tab-based layout with 3 tabs:

**Tab 1 — Utilisateurs:**
- Table of all users: Name | Email | Role badge | Poste | Supprimer button
- "+ Nouveau compte" button opens inline form:
  - Name, Email, Password (min 6), Role (EMPLOYEE/MANAGER), Poste (optional), Manager assignment (optional, only for EMPLOYEE)
- On create: hashes password, creates user + initial leave balance (25 CP, 10 RTT)
- Cannot delete own account
- Admin accounts cannot be deleted from this UI

**Tab 2 — Quotas congés:**
- Select employee from dropdown
- Input new CP days + RTT days
- Save → upserts LeaveBalance record

**Tab 3 — Actualités:**
- Textarea for company-wide announcement
- Publish → creates News record, visible on all dashboards

---

## Navigation & Shell

### Sidebar (w-60, sticky, full height)
- Logo: "🚀 Fair'Up OS" in indigo-600
- Nav items with Lucide icons:
  - LayoutDashboard → Tableau de Bord
  - CalendarDays → Congés & Absences
  - FileText → Bulletins de Paie
  - LifeBuoy → Demandes Admin
  - CheckSquare → Validations (MANAGER+ADMIN only)
  - FilePlus2 → Documents (MANAGER+ADMIN only)
  - Settings → Administration (ADMIN only)
- Active item: `bg-indigo-600 text-white shadow-sm` with indigo-200 icon
- Inactive: `text-slate-500 hover:bg-slate-50`
- Bottom section: user avatar (initials) + name + role label + LogOut button
- LogOut button: hover red

### Header (h-14, sticky top)
- Left: current page title (derived from pathname)
- Right: avatar dropdown showing name + role + "Se déconnecter"

### Loading states
Every route has a `loading.tsx` with pulsing gray skeleton cards matching the page layout.

---

## Shared Components

- **`StatusBadge`** — takes `status` string + `label`. Colors: PENDING/IN_PROGRESS=amber, APPROVED/RESOLVED=emerald, REJECTED=red, OPEN=blue
- **`EmptyState`** — takes Lucide icon + title + optional description + optional action button. Centered, py-14, icon in gray circle.

---

## Seed Data (demo accounts)

| Name | Email | Password | Role |
|------|-------|----------|------|
| Sophie Martin | admin@fairup.fr | admin123 | ADMIN |
| Jean Dupont | manager1@fairup.fr | manager123 | MANAGER |
| Claire Bernard | manager2@fairup.fr | manager123 | MANAGER |
| Thomas Petit | emp1@fairup.fr | emp123 | EMPLOYEE |
| Marie Lambert | emp2@fairup.fr | emp123 | EMPLOYEE |
| Nicolas Roux | emp3@fairup.fr | emp123 | EMPLOYEE |

Each employee gets a LeaveBalance (25 CP, 10 RTT, expiry June next year).
Create at least 2 payslips per employee, 3 tickets, 2 news entries.
