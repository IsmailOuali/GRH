"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, FormMessage } from "@/components/ui/Field";
import { controlClass } from "@/components/ui/control";
import {
  CHANGE_TOPICS,
  FIELD_HINTS,
  getTopic,
  MAX_CHANGE_COMMENT,
  topicFields,
} from "@/lib/profile-changes";
import { submitProfileChange } from "./actions";
import { useFeedback } from "@/lib/toast";

/**
 * "Signaler un changement": pick the block to change, edit the values (pre-filled
 * with the current ones), send. The RH validates before anything is updated.
 */
export function ChangeForm({
  current,
  /** Topics that already have a pending request — greyed out of the choice. */
  pendingTopics,
}: {
  /** Current dossier values, keyed by column. */
  current: Record<string, string>;
  pendingTopics: string[];
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useFeedback();

  const selected = getTopic(topic);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return; // no double submit
    setLoading(true);
    setMsg(null);
    try {
      const result = await submitProfileChange(new FormData(ref.current!));
      if ("success" in result) {
        setMsg({ type: "ok", text: "Demande envoyée. Votre fiche sera mise à jour dès validation par les RH." });
        ref.current?.reset();
        setTopic("");
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
      <Field label="Que souhaitez-vous modifier ?" required>
        {(props) => (
          <select
            {...props}
            name="topic"
            required
            value={topic}
            onChange={(e) => {
              setTopic(e.target.value);
              setMsg(null);
            }}
            className={controlClass}
          >
            <option value="" disabled>
              Choisir…
            </option>
            {CHANGE_TOPICS.map((t) => (
              <option key={t.value} value={t.value} disabled={pendingTopics.includes(t.value)}>
                {t.label}
                {pendingTopics.includes(t.value) ? " (demande en attente)" : ""}
              </option>
            ))}
          </select>
        )}
      </Field>

      {/* Keyed by topic so the inputs reset to the right current values. */}
      {selected && (
        <div key={selected.value} className="space-y-4">
          {topicFields(selected).map((f) => (
            <Field key={f.name} label={f.label} required hint={FIELD_HINTS[f.name]}>
              {(props) =>
                f.type === "select" ? (
                  <select {...props} name={f.name} required defaultValue={current[f.name] ?? ""} className={controlClass}>
                    <option value="" disabled>
                      Choisir…
                    </option>
                    {(f.options ?? []).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : f.type === "textarea" ? (
                  <textarea
                    {...props}
                    name={f.name}
                    rows={3}
                    required
                    defaultValue={current[f.name] ?? ""}
                    className={controlClass}
                  />
                ) : (
                  <input
                    {...props}
                    name={f.name}
                    type={f.type === "number" ? "number" : "text"}
                    {...(f.type === "number" ? { min: 0, max: 20, step: 1, inputMode: "numeric" as const } : {})}
                    required
                    defaultValue={current[f.name] ?? ""}
                    className={controlClass}
                  />
                )
              }
            </Field>
          ))}

          <Field label="Commentaire" hint="Optionnel — par exemple la date d'effet.">
            {(props) => (
              <textarea {...props} name="comment" rows={2} maxLength={MAX_CHANGE_COMMENT} className={controlClass} />
            )}
          </Field>
        </div>
      )}

      {msg?.type === "err" && <FormMessage type="err">{msg.text}</FormMessage>}

      <Button type="submit" loading={loading} disabled={!selected} fullWidth>
        Envoyer pour validation
      </Button>
    </form>
  );
}
