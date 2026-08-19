"use client";

import { useState, useRef } from "react";
import { Loader2, Trash2, Plus, X, Building2, Pencil, Check, KeyRound } from "lucide-react";
import { TappableRow } from "@/components/TappableRow";
import {
  createEmployee,
  deleteEmployee,
  updateLeaveBalance,
  publishNews,
  createCompany,
  updateCompany,
  deleteCompany,
  sendPasswordReset,
} from "./actions";

type User = { id: string; name: string; email: string; role: string; position: string | null };
type Company = { code: string; name: string; tagline: string | null; logoPath: string | null };

// ── Tab switcher ──────────────────────────────────────────────────────────────
const TABS = ["Utilisateurs", "Quotas congés", "Actualités", "Entreprises"] as const;
type Tab = typeof TABS[number];

export function AdminTabs({ users, managers, companies }: { users: User[]; managers: User[]; companies: Company[] }) {
  const [tab, setTab] = useState<Tab>("Utilisateurs");

  return (
    <div>
      <div className="scrollbar-none flex gap-1 overflow-x-auto border-b border-slate-200 mb-6">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px shrink-0 whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors rounded-t-lg ${
              tab === t ? "border-b-2 border-brand-600 text-brand-600" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Utilisateurs" && <UserManagement users={users} managers={managers} />}
      {tab === "Quotas congés" && <QuotaForm users={users} />}
      {tab === "Actualités" && <NewsForm />}
      {tab === "Entreprises" && <CompaniesForm companies={companies} />}
    </div>
  );
}

// ── Companies tab ─────────────────────────────────────────────────────────────
function CompaniesForm({ companies }: { companies: Company[] }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const result = await createCompany(new FormData(formRef.current!));
    if (result.success) {
      setMsg({ type: "ok", text: `Entreprise créée (code ${result.code}).` });
      formRef.current?.reset();
    } else {
      setMsg({ type: "err", text: result.error ?? "Erreur." });
    }
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      {/* Existing companies */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-medium text-slate-700">{companies.length} entreprise(s)</h2>
        </div>
        <ul className="divide-y divide-slate-100">
          {companies.map((c) => (
            <CompanyRow key={c.code} company={c} canDelete={companies.length > 1} />
          ))}
        </ul>
      </div>

      {/* Add company */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm max-w-lg">
        <h2 className="mb-4 font-medium text-slate-700">Ajouter une entreprise</h2>
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Nom de l&apos;entreprise</label>
            <input
              name="name"
              required
              placeholder="Ex : Fair Group"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-[3px] focus:ring-brand-500/20"
            />
            <p className="mt-1 text-xs text-slate-500">Un code unique sera généré automatiquement à partir du nom.</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Logo (optionnel)</label>
            <input
              name="logo"
              type="file"
              accept="image/*"
              className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-600 hover:file:bg-brand-100"
            />
            <p className="mt-1 text-xs text-slate-500">Image (PNG, JPG…), 2 Mo max.</p>
          </div>
          {msg && <p className={`text-sm ${msg.type === "ok" ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</p>}
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Créer l&apos;entreprise
          </button>
        </form>
      </div>
    </div>
  );
}

function CompanyRow({ company, canDelete }: { company: Company; canDelete: boolean }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const hasLogo = !!company.logoPath || company.code === "FAIRUP";

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy("save");
    setErr(null);
    const fd = new FormData(formRef.current!);
    fd.set("code", company.code);
    const res = await updateCompany(fd);
    setBusy(null);
    if (res.success) setEditing(false);
    else setErr(res.error ?? "Erreur.");
  }

  async function handleDelete() {
    if (!confirm(`Supprimer l'entreprise « ${company.name} » ?`)) return;
    setBusy("delete");
    setErr(null);
    const fd = new FormData();
    fd.set("code", company.code);
    const res = await deleteCompany(fd);
    setBusy(null);
    if (!res.success) setErr(res.error ?? "Erreur.");
  }

  if (editing) {
    return (
      <li className="px-5 py-4">
        <form ref={formRef} onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Nom de l&apos;entreprise</label>
            <input
              name="name"
              defaultValue={company.name}
              required
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-[3px] focus:ring-brand-500/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Nouveau logo (optionnel)</label>
            <input
              name="logo"
              type="file"
              accept="image/*"
              className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-600 hover:file:bg-brand-100"
            />
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy === "save"}
              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {busy === "save" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Enregistrer
            </button>
            <button
              type="button"
              onClick={() => { setEditing(false); setErr(null); }}
              className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50/70"
            >
              Annuler
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-4 px-5 py-3">
      <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-50">
        {hasLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/companies/${company.code}/logo`} alt={company.name} className="h-full w-full object-contain p-1" />
        ) : (
          <Building2 className="size-5 text-slate-400" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-slate-800">{company.name}</p>
        <p className="text-xs text-slate-500">
          <span className="font-mono">{company.code}</span>
          {company.tagline ? ` · ${company.tagline}` : ""}
        </p>
        {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
      </div>
      <button
        onClick={() => setEditing(true)}
        className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        title="Modifier"
      >
        <Pencil className="size-4" />
      </button>
      {canDelete && (
        <button
          onClick={handleDelete}
          disabled={busy === "delete"}
          className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
          title="Supprimer"
        >
          {busy === "delete" ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        </button>
      )}
    </li>
  );
}

// ── Users tab ─────────────────────────────────────────────────────────────────
function UserManagement({ users, managers }: { users: User[]; managers: User[] }) {
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);
  const [resetLoadingId, setResetLoadingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [selectedRole, setSelectedRole] = useState("EMPLOYEE");

  const ROLE_LABELS: Record<string, string> = { EMPLOYEE: "Salarié", SUPERVISEUR: "Superviseur", MANAGER: "Responsable" };

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const result = await createEmployee(new FormData(formRef.current!));
    if (result.success) {
      setMsg({ type: "ok", text: "Compte créé avec succès." });
      formRef.current?.reset();
      setShowForm(false);
    } else {
      setMsg({ type: "err", text: result.error ?? "Erreur." });
    }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    const user = users.find((u) => u.id === id);
    if (!confirm(`Supprimer le compte${user ? ` de ${user.name}` : ""} ?`)) return;
    setDeleteLoadingId(id);
    const fd = new FormData();
    fd.append("id", id);
    await deleteEmployee(fd);
    setDeleteLoadingId(null);
  }

  async function handleReset(id: string) {
    setResetLoadingId(id);
    setMsg(null);
    const fd = new FormData();
    fd.append("id", id);
    const res = await sendPasswordReset(fd);
    if (res?.success) setMsg({ type: "ok", text: `Email de réinitialisation envoyé à ${res.email}.` });
    else setMsg({ type: "err", text: res?.error ?? "Erreur." });
    setResetLoadingId(null);
  }

  return (
    <div className="space-y-4">
      {msg && (
        <p className={`text-sm ${msg.type === "ok" ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</p>
      )}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-medium text-slate-700">{users.length} compte(s)</h2>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm text-white hover:bg-brand-700"
          >
            {showForm ? <X className="size-4" /> : <Plus className="size-4" />}
            {showForm ? "Annuler" : "Nouveau compte"}
          </button>
        </div>

        {showForm && (
          <form ref={formRef} onSubmit={handleCreate} className="px-5 py-4 border-b border-brand-50 bg-brand-50/40 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Nom complet</label>
              <input name="name" required className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-[3px] focus:ring-brand-500/20" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Email</label>
              <input name="email" type="email" required className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-[3px] focus:ring-brand-500/20" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Mot de passe (min 6)</label>
              <input name="password" type="password" minLength={6} required className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-[3px] focus:ring-brand-500/20" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Rôle</label>
              <select name="role" value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-[3px] focus:ring-brand-500/20">
                <option value="EMPLOYEE">Salarié</option>
                <option value="SUPERVISEUR">Superviseur</option>
                <option value="MANAGER">Responsable</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Poste (optionnel)</label>
              <input name="position" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-[3px] focus:ring-brand-500/20" />
            </div>
            {selectedRole === "EMPLOYEE" && (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Responsable (optionnel)</label>
                <select name="managerId" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-[3px] focus:ring-brand-500/20">
                  <option value="">— Aucun —</option>
                  {managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            )}
            <div className="sm:col-span-2">
              <button type="submit" disabled={loading} className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-60">
                {loading && <Loader2 className="size-4 animate-spin" />}
                Créer le compte
              </button>
            </div>
          </form>
        )}

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th className="px-5 py-3 font-medium">Nom</th>
              <th className="hidden px-5 py-3 font-medium md:table-cell">Email</th>
              <th className="px-5 py-3 font-medium">Rôle</th>
              <th className="hidden px-5 py-3 font-medium md:table-cell">Poste</th>
              <th className="hidden px-5 py-3 font-medium md:table-cell"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => {
              const roleBadge = (
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  u.role === "ADMIN" ? "bg-brand-100 text-brand-700" :
                  u.role === "MANAGER" ? "bg-violet-100 text-violet-700" :
                  u.role === "SUPERVISEUR" ? "bg-cyan-100 text-cyan-700" :
                  "bg-slate-100 text-slate-600"
                }`}>
                  {u.role === "ADMIN" ? "Directeur" : u.role === "MANAGER" ? "Responsable" : u.role === "SUPERVISEUR" ? "Superviseur" : "Salarié"}
                </span>
              );
              const resetBtn = u.role !== "ADMIN" && (
                <button
                  onClick={() => handleReset(u.id)}
                  disabled={resetLoadingId === u.id}
                  title="Envoyer un lien de réinitialisation du mot de passe"
                  className="rounded p-1.5 text-slate-400 hover:bg-brand-50 hover:text-brand-600 disabled:opacity-40"
                >
                  {resetLoadingId === u.id ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                </button>
              );
              const deleteBtn = u.role !== "ADMIN" && (
                <button
                  onClick={() => handleDelete(u.id)}
                  disabled={deleteLoadingId === u.id}
                  title="Supprimer le compte"
                  className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                >
                  {deleteLoadingId === u.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                </button>
              );
              const actions = (resetBtn || deleteBtn) && (
                <div className="flex items-center gap-1">
                  {resetBtn}
                  {deleteBtn}
                </div>
              );
              return (
                <TappableRow
                  key={u.id}
                  className="hover:bg-slate-50/70"
                  detail={{
                    title: u.name,
                    items: [
                      { label: "Nom", value: u.name },
                      { label: "Email", value: u.email },
                      { label: "Rôle", value: roleBadge },
                      { label: "Poste", value: u.position ?? "" },
                      ...(actions ? [{ label: "Actions", value: actions }] : []),
                    ],
                  }}
                >
                  <td className="px-5 py-3 font-medium text-slate-800">{u.name}</td>
                  <td className="hidden px-5 py-3 text-slate-500 md:table-cell">{u.email}</td>
                  <td className="px-5 py-3">{roleBadge}</td>
                  <td className="hidden px-5 py-3 text-slate-500 md:table-cell">{u.position ?? "—"}</td>
                  <td className="hidden px-5 py-3 md:table-cell">{actions}</td>
                </TappableRow>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Quotas tab ────────────────────────────────────────────────────────────────
function QuotaForm({ users }: { users: User[] }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const result = await updateLeaveBalance(new FormData(formRef.current!));
    if (result.success) setMsg({ type: "ok", text: "Quotas mis à jour." });
    else setMsg({ type: "err", text: result.error ?? "Erreur." });
    setLoading(false);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm max-w-md">
      <h2 className="mb-4 font-medium text-slate-700">Modifier les quotas</h2>
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Salarié</label>
          <select name="userId" required className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-[3px] focus:ring-brand-500/20">
            {users.filter((u) => u.role !== "ADMIN").map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role === "MANAGER" ? "Resp." : u.role === "SUPERVISEUR" ? "Superv." : "Salarié"})
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Jours CP</label>
            <input name="cpDays" type="number" min="0" step="0.5" defaultValue={25} required className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-[3px] focus:ring-brand-500/20" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Jours RTT</label>
            <input name="rttDays" type="number" min="0" step="0.5" defaultValue={10} required className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-[3px] focus:ring-brand-500/20" />
          </div>
        </div>
        {msg && <p className={`text-sm ${msg.type === "ok" ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</p>}
        <button type="submit" disabled={loading} className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-60">
          {loading && <Loader2 className="size-4 animate-spin" />}
          Enregistrer
        </button>
      </form>
    </div>
  );
}

// ── News tab ──────────────────────────────────────────────────────────────────
function NewsForm() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const result = await publishNews(new FormData(formRef.current!));
    if (result.success) {
      setMsg({ type: "ok", text: "Actualité publiée." });
      formRef.current?.reset();
    } else {
      setMsg({ type: "err", text: result.error ?? "Erreur." });
    }
    setLoading(false);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm max-w-lg">
      <h2 className="mb-4 font-medium text-slate-700">Publier une actualité</h2>
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Message</label>
          <textarea name="content" rows={5} required placeholder="Rédigez votre annonce ici..." className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-[3px] focus:ring-brand-500/20" />
        </div>
        {msg && <p className={`text-sm ${msg.type === "ok" ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</p>}
        <button type="submit" disabled={loading} className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-60">
          {loading && <Loader2 className="size-4 animate-spin" />}
          Publier
        </button>
      </form>
    </div>
  );
}
