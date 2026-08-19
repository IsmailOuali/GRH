"use client";

import { useState, useRef } from "react";
import { Upload } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, FormMessage } from "@/components/ui/Field";
import { controlClass } from "@/components/ui/control";

type User = { id: string; name: string };

export function UploadPayslipForm({ employees }: { employees: User[] }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    const formData = new FormData(formRef.current!);
    const res = await fetch("/api/payslips/upload", { method: "POST", body: formData });
    const data = await res.json();

    if (res.ok) {
      setMsg({ type: "ok", text: "Bulletin uploadé avec succès." });
      formRef.current?.reset();
    } else {
      setMsg({ type: "err", text: data.error ?? "Erreur lors de l'upload." });
    }
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader title="Uploader un bulletin" />
      <CardBody>
        {/* Capped width: a select and a short month string read as errors when
            stretched across a 1000px card. */}
        <form ref={formRef} onSubmit={handleSubmit} className="max-w-md space-y-4">
          <Field label="Employé" required>
            {(props) => (
              <select {...props} name="userId" required className={controlClass}>
                <option value="">— Sélectionner —</option>
                {employees.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            )}
          </Field>

          <Field label="Mois" hint="Format attendu : « Juin 2025 »." required>
            {(props) => (
              <input {...props} name="month" required placeholder="Juin 2025" className={controlClass} />
            )}
          </Field>

          <Field label="Fichier PDF" required>
            {(props) => (
              <input
                {...props}
                name="file"
                type="file"
                accept="application/pdf"
                required
                className={`${controlClass} file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1 file:text-sm file:font-medium file:text-brand-700`}
              />
            )}
          </Field>

          {msg && <FormMessage type={msg.type}>{msg.text}</FormMessage>}

          <Button type="submit" loading={loading}>
            {!loading && <Upload className="size-4" aria-hidden />}
            Uploader
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
