"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, FormMessage } from "@/components/ui/Field";
import { controlClass } from "@/components/ui/control";
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_SUBJECT_LENGTH,
  TICKET_CATEGORIES,
} from "@/lib/tickets";
import { submitTicket } from "./actions";

/** A salarié reports an error or asks the RH a question. */
export function TicketForm() {
  const ref = useRef<HTMLFormElement>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return; // no double submit
    setLoading(true);
    setMsg(null);
    try {
      const result = await submitTicket(new FormData(ref.current!));
      if ("success" in result) {
        setMsg({ type: "ok", text: "Ticket envoyé. Les RH vous répondront ici." });
        ref.current?.reset();
      } else {
        setMsg({ type: "err", text: result.error });
      }
    } catch {
      // The action threw (network, server restarting…): never leave the form stuck.
      setMsg({ type: "err", text: "Impossible de contacter le serveur. Réessayez dans un instant." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form ref={ref} onSubmit={handleSubmit} className="space-y-4">
      <Field label="Catégorie" required>
        {(props) => (
          <select {...props} name="category" required defaultValue="" className={controlClass}>
            <option value="" disabled>
              Choisir…
            </option>
            {TICKET_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field label="Objet" required hint="En une phrase : par exemple « Heures supplémentaires manquantes en octobre ».">
        {(props) => (
          <input
            {...props}
            name="subject"
            type="text"
            required
            maxLength={MAX_SUBJECT_LENGTH}
            className={controlClass}
          />
        )}
      </Field>

      <Field
        label="Description"
        required
        hint="Précisez le mois, le montant ou la date concernés : cela évite un aller-retour."
      >
        {(props) => (
          <textarea
            {...props}
            name="description"
            rows={6}
            required
            maxLength={MAX_DESCRIPTION_LENGTH}
            className={controlClass}
          />
        )}
      </Field>

      {msg && <FormMessage type={msg.type}>{msg.text}</FormMessage>}

      <Button type="submit" loading={loading} fullWidth>
        Envoyer aux RH
      </Button>
    </form>
  );
}
