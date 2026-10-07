# Fair'Up OS — UX / UI recommendations

_Based on a code read (not a live walkthrough) of the design system, nav, login, dashboard, congés, tables and forms. Effort: 🟢 small · 🟡 medium · 🔴 large._

## P0 — Visible problems

1. **Remove demo credentials from the login page** 🟢 — `app/login/page.tsx` shows admin/manager/employee passwords to everyone. Gate behind `NODE_ENV !== "production"`. Also add a "Mot de passe oublié ?" link (the reset flow exists but isn't reachable from login).
2. **Replace `window.alert` / `window.confirm`** 🟡 — used in `RemoteRequestButtons`, `SuiviRowActions`, `DossierDeleteButton`, `RemoteDayDeleteButton`, `AdminForms`. Native dialogs are unstyled, block the thread and break the polished feel. Build one `ConfirmDialog` + a toast component (neither exists) and use them for every destructive action and every action result.
3. **Leave form feedback is easy to miss** 🟢 — `LeaveForm` shows a message under the button, and success only resets the form. Add a toast, scroll/focus the message, and on success switch to the "Historique" tab so the user sees the new PENDING row.

## P1 — Navigation & information architecture

4. **Too many tabs on the manager Congés page** 🟡 — 7 tabs (En attente, Suivi RH, Statistiques, Import CSV, Planning, Historique équipe, Nouvelle demande) in a horizontally scrolling bar; on mobile the later tabs are hidden with no scroll cue. Group them: *À valider · Planning · Suivi RH (Suivi / Stats / Import as sub-sections) · Historique*, and put "Nouvelle demande" behind a primary button in the page header. Add edge fade/chevrons on the scrollable tab bar.
5. **Tab state is lost on refresh/navigation** 🟢 — `Tabs` keeps state in `useState`. Sync it to `?tab=` so links from notifications/badges ("/conges" with pending count) land directly on "En attente", and back/refresh keep position.
6. **Notifications and badges should deep-link** 🟢 — links are bare `/conges`, `/documents`; use `?tab=pending` etc. once #5 exists.
7. **Mobile bottom bar** 🟢 — 4 primary items; Télétravail, Coffre-fort, Dossiers, Admin are only in the drawer. Consider a "Plus" tab, and show pending badges on the bar for managers.

## P1 — Forms

8. **Leave form guardrails** 🟡 — show remaining balance next to the type (CP/RTT) and warn *before* submit when `days > balance` (today the error only comes back from the server); disable weekends/past dates or warn on overlap with existing requests; display "X jours ouvrés" with a note that weekends are excluded.
9. **Inline validation** 🟡 — forms rely on a single message under the button. Add per-field errors with `aria-describedby`, preserve typed values on server error, and keep the submit button label meaningful while loading ("Envoi…").
10. **Document request forms** 🟡 — show an "auto-rempli depuis la fiche salarié" hint on prefilled fields (and a "fiche manquante" notice when none exists), plus a PDF preview/summary step before submitting.

## P1 — Tables & lists

11. **Search, filter, sort, pagination** 🟡 — every table loads all rows (users, payslips, dossiers, histories). Start with a search box + status filter on Admin users, Dossiers, Congés histories.
12. **Keyboard access for mobile rows** 🟢 — `TappableRow` opens on `onClick` of a `<tr>` only; add `role="button"`, `tabIndex`, Enter/Space handling, and move focus into/out of `MobileDetailModal` (focus trap + Esc).
13. **Status badges** 🟢 — make sure each badge pairs colour with an icon/text (it already uses text); add a legend for planning codes (CP/RTT/MAL/SS/TT) — the planning uses 2–3 letter codes that new users won't know.
14. **Better empty & loading states** 🟢 — empty states are generic; add a primary CTA ("Faire une demande", "Importer un bulletin"). Loading skeletons exist per route, but long actions (PDF generation on approve, which launches Puppeteer) show only a spinner — show "Génération du PDF…" and disable double-clicks.

## P2 — Visual system

15. **Finish or remove dark mode** 🟡 — `globals.css` defines an opt-in `[data-theme="dark"]` but only the dashboard/Card/coffre-fort use `dark:` and nothing sets the attribute. Either complete the migration and add a toggle (+ respect `prefers-color-scheme`), or delete the half-done classes.
16. **Consolidate colour usage** 🟢 — comment says no page should hardcode `indigo-*/violet-*`, yet ~11 usages remain (planning palette, etc.); ~50 files use raw `slate-*`. Move to semantic tokens (`text-muted`, `surface`) so the per-company theme and dark mode apply everywhere.
17. **Company switcher visibility** 🟡 — managers/admins pick a company once via a cookie; show the active company + logo in the header with a one-click switcher, since mixing data across agencies is the riskiest mistake. Branding in Sidebar/MobileNav still special-cases FAIRUP/FAIR2UP (see ERRORS_AND_FIXES #5).
18. **Dashboard** 🟡 — add a "Prochain congé / Prochain télétravail" card and quick actions ("Demander un congé", "Demander une attestation") for employees; show leave balance as CP *and* RTT (RTT currently isn't on the dashboard). News: truncate with "Lire la suite" instead of tooltip-only full text (tooltips don't exist on touch).

## P2 — Content & accessibility

19. **Language & copy** 🟢 — unify terms (Salarié/Employé, Demande/Requête, Responsable/Manager/Directeur); role labels differ between docs (Directeur) and UI. Use the same French everywhere, and consistent date format `dd/MM/yyyy` (some places use `yyyy-MM-dd`).
20. **Accessibility pass** 🟢 — contrast check on `text-slate-400` icons/hints, visible focus rings on all custom controls, `aria-live` on async results, `prefers-reduced-motion` for `animate-rise`.
21. **Arabic / RTL** 🔴 — longer-term, see SUGGESTIONS #15.

## Suggested order
1. #1, #2, #3 (quick, high-impact) → 2. #5/#6, #4 (navigation) → 3. #8–#12 (forms/tables) → 4. #15–#18 (visual system).
