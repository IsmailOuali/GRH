# Fair'Up OS — Errors & Points to Change

_Review date: 2026-07-01. Paths are relative to the repo root._

Severity legend: 🔴 blocking/bug · 🟠 security · 🟡 consistency/cleanup · ⚪ minor/nice-to-fix.

---

## 🔴 1. Build-breaking TypeScript errors

`npx tsc --noEmit` (and therefore `next build`) currently fails on **2 files**:

| File | Line | Problem | Fix |
|---|---|---|---|
| `prisma/seed.ts` | 165 | Creates `Payslip` with `transferDate` / `grossAmount` / `deductions` / `netAmount`, which no longer exist on the `Payslip` model. | Rewrite the payslip seed to `{ userId, month, pdfPath? }`, or restore the columns (see #2). |
| `src/app/api/payslips/[id]/download/route.ts` | 31 | `new NextResponse(buffer, …)` — a Node `Buffer` isn't a valid `BodyInit`. | Wrap it: `new NextResponse(new Uint8Array(buffer), …)` (this is exactly how the dossier/document routes already do it). |

> Dev mode (`next dev`) transpiles without type-checking, which is why the app runs despite these. A production build will not.

---

## 🔴 2. Prisma schema ↔ database drift (Payslip)

The initial migration (`prisma/migrations/20260604144657_init`) created `Payslip` with `transferDate`, `grossAmount`, `deductions`, `netAmount`, but `prisma/schema.prisma`'s `Payslip` model only has `month` + `pdfPath`. The columns still exist in the DB but not in the model.

**Fix:** decide the intent and reconcile:
- If payslip amounts aren't needed → add a migration that drops those columns.
- If they are (recommended, see UPGRADES) → add them back to the model and to `UploadPayslipForm`.

Either way, fix `seed.ts` to match.

---

## 🔴 3. `prisma/seed.ts` is stale / broken

- Fails to run (`prisma db seed`) because of #1/#2.
- Seeds user names (`Sophie Martin`, `Jean Dupont`…) that differ from what's actually in the running DB (`Hakim`, `Kabil`…).
- Does **not** seed the new `Company` rows (they only exist via migration), so a fresh `prisma migrate reset` + seed would create users but rely on the migration for companies — fragile.

**Fix:** bring the seed in line with the current schema, seed `Company` via `upsert`, and keep names consistent.

---

## 🔴 4. Double `deleteEmployee` call in the admin UI

`src/app/(dashboard)/admin/AdminForms.tsx` (~line 160):

```ts
await deleteEmployee(Object.assign(new FormData(), { id })); // no-op: doesn't set a form field
const fd = new FormData(); fd.append("id", id);
await deleteEmployee(fd);                                    // the real call
```

The first call sends a `FormData` with no `id` field (returns `"ID manquant"` and does nothing), then the row is deleted by the second call. Dead/confusing code that fires the action twice.

**Fix:** remove the first call.

---

## 🔴 5. Company branding is still hardcoded (regression after DB-backed companies)

Now that companies can be created dynamically, the sidebar and mobile header still special-case only `FAIRUP` / `FAIR2UP`:

- `src/components/Sidebar.tsx` (~L15, L50-62) — `COMPANY_STYLES` + `company === "FAIRUP" ? logo : "F2"` and the title `"Fair'Up OS" / "FAIR2UP"`.
- `src/components/MobileNav.tsx` (~L84-89) — same pattern.

**Any newly created company renders as "FAIR2UP" (violet "F2")** in the nav.

**Fix:** pass the active company's real `name` + `logoPath` from the dashboard layout (it already loads the company code) and render name + `/api/companies/[code]/logo` generically.

---

## 🟠 6. Cross-company data leak — payslip download

`src/app/api/payslips/[id]/download/route.ts` checks role but **not company**:

```ts
if (!isManager && payslip.userId !== session.user.id) return 403;
```

Any `MANAGER`/`ADMIN` can download **any** employee's payslip in **any** company by guessing the id. Payslips are sensitive.

**Fix:** scope to the actor's active company (join `payslip.user.company === activeCompany`), mirroring the dossier download route.

---

## 🟠 7. Cross-company leak + fragile path — document download

`src/app/api/documents/download/[id]/route.ts`:
- Only restricts `EMPLOYEE` to their own docs; a manager/admin can download any company's generated document.
- Reads `fs.readFileSync(docRequest.pdfPath)` where `pdfPath` is stored as an **absolute path** (`documents/actions.ts:81` does `path.join(process.cwd(), …)`). Absolute paths in the DB break if the app moves/deploys elsewhere, and reading a DB-controlled absolute path is a mild path-safety smell.

**Fix:** store only the filename (like payslips/dossiers), rebuild the path at read time, add company scoping, and use async `readFile`.

---

## 🟠 8. Payslip upload doesn't validate the target's company

`src/app/api/payslips/upload/route.ts` trusts the `userId` from the form and never checks it belongs to the uploader's active company, so a manager could attach a payslip to a user in another company. Also no size cap (only mime).

**Fix:** verify `user.company === activeCompany` before writing; add a size limit (like the dossier upload's 5 MB).

---

## 🟡 9. Dead code — `src/lib/users.ts`

The in-memory user store (`getUserByEmail`, `verifyPassword`) is unused — auth now queries Prisma (`src/auth.ts`). It's only referenced within itself.

**Fix:** delete `src/lib/users.ts`.

---

## 🟡 10. `.gitignore` misses sensitive artifacts

`.gitignore` ignores `.env*` and `next-env.d.ts` but **not**:
- `uploads/` — contains uploaded payslips, dossiers and their **confidential** source PDFs.
- `prisma/dev.db` (and `-journal`/`-wal`) — the SQLite database with real personal data.
- `dev.log`.

These aren't committed yet (only an initial commit exists), but they will be on the next `git add`.

**Fix:** add `uploads/`, `*.db`, `*.db-journal`, `prisma/*.db`, `dev.log` to `.gitignore`.

---

## 🟡 11. Inconsistent stored-file-path convention

- Payslips & dossiers store just the **filename** and rebuild the path at read time. ✅
- Documents store the **absolute path** in `DocumentRequest.pdfPath`. ❌ (see #7)

**Fix:** standardize on filename-only everywhere.

---

## 🟡 12. Inconsistent server-action error handling

Some actions **throw** (`admin/actions.ts` → `requireManager()` throws `"Accès refusé."`), others **return** `{ error }`. Client handlers (e.g. `AdminForms` `handleCreate`) have no `try/catch`, so if an action throws, the `await` rejects and the button stays stuck in the loading state.

**Fix:** either make guards return `{ error }` consistently, or wrap client calls in `try/catch/finally` that always resets loading.

---

## ⚪ 13. Template renderer leaks unmatched placeholders

`src/lib/documents/render-template.ts` returns the original `{{key}}` when a field is missing, so an incomplete document can render literal `{{nom_prenom}}` in the PDF. Consider replacing unmatched tokens with `""` (or validating completeness before generating — the request path already validates required fields, the direct-generate path via API does too, but the fallback behavior is still surprising).

---

## ⚪ 14. Union return types accessed by property

Actions return `{ error } | { success: true }` and callers read `result.success` directly. It compiles today but is fragile; prefer an explicit discriminated return type + `"error" in res` narrowing (already done for the dossier actions — apply the same to `admin`/`documents`/`tickets` actions for consistency).

---

## ⚪ 15. Accessibility / minor

- `TappableRow` opens the mobile detail popup on `onClick` on a `<tr>` — not keyboard-focusable (can't Tab/Enter to it). Add `role="button"` + `tabIndex` + key handler, or a visually-hidden trigger, if a11y matters.
- Password policy is min 6 chars (`createEmployee`) — weak.
- No rate limiting on the upload endpoints.
- `renderDossierHtml` / generated PDFs don't include the company logo (the fiche is text-only) — cosmetic.

---

## Quick-win checklist

- [ ] Fix the 2 tsc errors (#1) → unblock `next build`.
- [ ] Reconcile Payslip schema/DB + seed (#2, #3).
- [ ] Remove the double `deleteEmployee` call (#4).
- [ ] Make sidebar/mobile branding company-aware (#5).
- [ ] Add company scoping to payslip & document downloads (#6, #7).
- [ ] Delete `src/lib/users.ts` (#9).
- [ ] Update `.gitignore` (#10).
