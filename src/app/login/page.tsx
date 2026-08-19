"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { controlClass, labelClass } from "@/components/ui/control";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await signIn("credentials", { email, password, redirect: false });
      if (res?.error) setError("Email ou mot de passe incorrect.");
      else router.push("/dashboard");
    } catch {
      setError("Erreur réseau. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-7 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/api/logo/fairup"
            alt="Fair'Up OS"
            className="mx-auto h-11 w-auto object-contain"
          />
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-slate-900">
            Connexion à votre espace
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Portail RH interne — congés, paie, documents
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-900/[0.07] sm:p-7">
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <label htmlFor="email" className={labelClass}>
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                required
                placeholder="prenom.nom@fairup.fr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={error ? true : undefined}
                className={controlClass}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className={labelClass}>
                Mot de passe
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={error ? true : undefined}
                  className={`${controlClass} pr-11`}
                />
                {/* Typo-recovery on a field you can't read back is the single
                    biggest friction point on a login form. */}
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-xl text-slate-400 transition-colors hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                </button>
              </div>
            </div>

            {/* aria-live so the failure is announced, not just repainted. */}
            <div aria-live="polite">
              {error && (
                <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              )}
            </div>

            <Button type="submit" loading={loading} fullWidth>
              Se connecter
            </Button>
          </form>
        </div>

        <div className="mt-5 rounded-2xl bg-white/60 p-4 text-xs text-slate-500 ring-1 ring-slate-900/[0.06]">
          <p className="mb-1.5 font-semibold text-slate-600">Comptes de démonstration</p>
          <dl className="space-y-1">
            {[
              ["Directeur", "admin@fairup.fr", "admin123"],
              ["Responsable", "manager1@fairup.fr", "manager123"],
              ["Salarié", "emp1@fairup.fr", "emp123"],
            ].map(([role, mail, pwd]) => (
              <div key={mail} className="flex flex-wrap items-baseline gap-x-2">
                <dt className="w-20 shrink-0 text-slate-500">{role}</dt>
                <dd className="font-mono text-slate-600">
                  {mail} · {pwd}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
