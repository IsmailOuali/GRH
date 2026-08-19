# Fair'Up OS — Suggestions (current)

_Written 2026-07-01, reflecting the app after the recent work. Supersedes the older
[UPGRADES_AND_IDEAS.md](UPGRADES_AND_IDEAS.md) where they overlap._

Priorities: **P0** = fix soon (bug / security), **P1** = high value, **P2** = nice to have.
Effort: 🟢 small · 🟡 medium · 🔴 large.

---

## ✅ Already shipped (don't re-plan these)

- Edit / delete company + guards, in Admin → Entreprises.
- Team **absence calendar** (fixed-size), in Congés and in a dashboard popup.
- **Auto-fill** document forms from a linked Dossier Salarié (CIN/CNSS/poste/date/contrat).
- Locked **Date de reprise** (next business day) in the leave form and Congés doc.
- Pending-demand **badges** in the nav and on the agency-selection cards.
- Removed the "Demandes Admin" (tickets) tab.

---

## P0 — Correctness & security (do first)

### 1. Fix the two build-breaking type errors 🟢
`tsc --noEmit` (and `next build`) currently fail on:
- `prisma/seed.ts:165` — seeds `transferDate` (and likely `grossAmount/deductions/netAmount`) that **don't exist** on the `Payslip` model.
- `src/app/api/payslips/[id]/download/route.ts:31` — `Buffer` passed where a `BodyInit` is expected (wrap in `new Uint8Array(pdf)`, like the other PDF routes do).

These block CI and any production build.

### 2. Reconcile the Payslip schema drift 🟡
`schema.prisma`'s `Payslip` has only `month` / `pdfPath`, but the seed and DB assume
`transferDate` / `grossAmount` / `deductions` / `netAmount`. Decide the source of truth,
add the columns back (migration), and you unlock a real **payslip summary** (gross/net/
déductions) instead of just a PDF link — plus a basis for the % cap in advances (#6).

### 3. Scope `reviewDocumentRequest` to company/team 🟢 **(security)**
[`documents/actions.ts`](<src/app/(dashboard)/documents/actions.ts>) `reviewDocumentRequest`
only checks the role — **not** the requester's company. A manager/admin could approve or
reject **any** company's request if they know its id. Compare with `reviewAdvance`
(company + team scoped) and `reviewLeave` (managerId for managers). Align all three so
approvals are consistently scoped. Low effort, real exposure on sensitive data.

### 4. Audit log for confidential access/actions 🟡 **(compliance)**
The dossier is marked "STRICTEMENT CONFIDENTIEL" (CIN, CNSS, address, bank docs). Log
who **viewed/edited/deleted** a dossier, who **switched company**, and who **approved**
what. Given anyone with MANAGER/ADMIN can switch into any company (a deliberate choice),
an audit trail is the right compensating control.

---

## P1 — High value

### 5. Leave balance is one-way 🟡
Balances are **decremented on approval** ([`conges/actions.ts`](<src/app/(dashboard)/conges/actions.ts>))
but never **re-credited**. Add:
- Re-credit when an approved CP/RTT leave is later cancelled/rejected.
- An employee **cancel request** flow (and manager cancel of an approved leave).
- Guard against **overlapping** requests for the same person.

### 6. Advances: repayment tracking + cap 🟡
Currently a request has amount/reason/month only. Add a **repayment status** (paid/pending),
and — once payslip amounts exist (#2) — an optional **% of salary cap** enforced at submit.

### 7. Moroccan public-holiday calendar 🟡
`nextBusinessDay` / business-day counts skip weekends only ([`lib/dates.ts`](src/lib/dates.ts)).
Add a per-year jours-fériés list so reprise dates and leave-day counts skip holidays too.
Store it centrally so both the leave form and document templates use it.

### 8. Real notifications (bell + email) 🟡🔴
Badges exist; extend to an in-app **notification center** (leave approved/refused, document
ready, new payslip, dossier linked) and optional **email** (Resend/SMTP). Biggest perceived-
quality jump. The `getPendingCounts` helper is a good starting point.

### 9. Table search / filter / pagination 🟡
Every table loads all rows (employees, payslips, dossiers, leave/advance history). Add
server-side pagination + search before data grows — start with the Admin users table and
the Congés/Paie history.

---

## P2 — Polish & platform

### 10. Automated tests 🟡
Pure, high-value units to lock in: `lib/dates.ts`, the dossier parser
`lib/dossiers/extract.ts` (both form variants as fixtures), and the access helpers
(`dossiers/access.ts`, the review-action scoping from #3). Add Playwright e2e for
login → leave request → approve, and dossier upload → regenerate.

### 11. CI pipeline 🟢
GitHub Actions running `tsc --noEmit`, `eslint`, `next build` on PRs — would have caught
#1 before it landed.

### 12. Calendar enhancements 🟢
Filter by leave type, a small color legend, let an employee see **their own** month, and an
"export month" (CSV/PNG). The component is already fixed-size and reused in two places.

### 13. Company logo in generated PDFs 🟢
Put the active company's logo atop regenerated dossiers and attestations (logos already
exist under `uploads/companies/`).

### 14. Production hardening 🟡
- Move `uploads/` (payslips, dossiers, logos) to blob storage — local disk won't survive
  most deployments; serve via signed URLs and confirm every `/api/**` file route checks auth.
- Move SQLite → Postgres for concurrency/backups.
- Auth: password-reset flow, rate limiting on `/api/auth` and upload routes.

### 15. Bilingual / RTL (fr + ar) 🔴
Morocco is bilingual and the UI is French-only. Introduce i18n with Arabic + RTL — a real
differentiator, but a large, cross-cutting change (do it before the string count explodes).

---

## Suggested order

1. **Stabilize:** #1, #2, #3 (a day's work, removes real risk) → then #11 CI + #10 tests.
2. **Value:** #8 notifications, #5 leave balance correctness, #9 pagination.
3. **Fit & scale:** #7 holidays, #6 advances, #14 prod hardening, #15 bilingual.
