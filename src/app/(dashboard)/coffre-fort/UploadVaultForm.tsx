"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, FormMessage } from "@/components/ui/Field";
import { controlClass } from "@/components/ui/control";
import { CATEGORY_LABELS, UPLOADABLE_CATEGORIES } from "@/lib/coffre-fort";

type Employee = { id: string; name: string };

/** HR files a document into the selected employee's coffre-fort. */
export function UploadVaultForm({ employee }: { employee: Employee }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    const formData = new FormData(formRef.current!);
    formData.set("userId", employee.id);
    const res = await fetch("/api/coffre-fort/upload", { method: "POST", body: formData });
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      setMsg({ type: "ok", text: "Document ajouté au coffre-fort." });
      formRef.current?.reset();
      router.refresh();
    } else {
      setMsg({ type: "err", text: data.error ?? "Erreur lors de l'ajout." });
    }
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader title={`Ajouter un document — ${employee.name}`} icon={Upload} />
      <CardBody>
        <form ref={formRef} onSubmit={handleSubmit} className="max-w-md space-y-4">
          <Field label="Intitulé" hint="Ex. « Contrat CDI signé »." required>
            {(props) => (
              <input {...props} name="title" required placeholder="Contrat CDI signé" className={controlClass} />
            )}
          </Field>

          <Field label="Catégorie" required>
            {(props) => (
              <select {...props} name="category" required defaultValue="" className={controlClass}>
                <option value="" disabled>
                  — Sélectionner —
                </option>
                {UPLOADABLE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field label="Fichier" hint="PDF ou image, 15 Mo max." required>
            {(props) => (
              <input
                {...props}
                name="file"
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                required
                className={`${controlClass} file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1 file:text-sm file:font-medium file:text-brand-700`}
              />
            )}
          </Field>

          {msg && <FormMessage type={msg.type}>{msg.text}</FormMessage>}

          <Button type="submit" loading={loading}>
            {!loading && <Upload className="size-4" aria-hidden />}
            Ajouter au coffre-fort
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
