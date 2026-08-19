"use client";

import { useRef, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, FormMessage } from "@/components/ui/Field";
import { controlClass } from "@/components/ui/control";
import { submitAdvance } from "./advance-actions";

export function AdvanceForm() {
  const ref = useRef<HTMLFormElement>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const res = await submitAdvance(new FormData(ref.current!));
    if ("error" in res) {
      setMsg({ type: "err", text: res.error });
    } else {
      setMsg({ type: "ok", text: "Demande d'avance envoyée." });
      ref.current?.reset();
    }
    setLoading(false);
  }

  return (
    <form ref={ref} onSubmit={handleSubmit} className="space-y-4">
      <Field label="Montant demandé (DH)" required>
        {(props) => (
          <input
            {...props}
            name="amount"
            type="number"
            min="1"
            step="0.01"
            required
            placeholder="Ex : 2000"
            className={controlClass}
          />
        )}
      </Field>

      <Field label="Mois de remboursement souhaité" hint="Optionnel.">
        {(props) => (
          <input {...props} name="repaymentMonth" placeholder="Ex : Août 2026" className={controlClass} />
        )}
      </Field>

      <Field label="Motif" hint="Optionnel — un contexte court accélère la validation.">
        {(props) => (
          <textarea
            {...props}
            name="reason"
            rows={3}
            placeholder="Précisez la raison de votre demande…"
            className={controlClass}
          />
        )}
      </Field>

      {msg && <FormMessage type={msg.type}>{msg.text}</FormMessage>}

      <Button type="submit" loading={loading} fullWidth>
        {!loading && <Send className="size-4" aria-hidden />}
        Soumettre la demande
      </Button>
    </form>
  );
}
