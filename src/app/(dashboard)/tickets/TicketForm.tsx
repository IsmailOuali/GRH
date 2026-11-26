"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, FormMessage } from "@/components/ui/Field";
import { controlClass } from "@/components/ui/control";
import {
  ATTACHMENT_MIME_TYPES,
  isImageMime,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS,
  MAX_DESCRIPTION_LENGTH,
  MAX_SUBJECT_LENGTH,
  TICKET_CATEGORIES,
} from "@/lib/tickets";
import { useFeedback } from "@/lib/toast";

const MAX_MB = MAX_ATTACHMENT_BYTES / 1024 / 1024;

/** A salarié reports an error or asks the RH a question, with screenshots if useful. */
export function TicketForm() {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useFeedback();

  // Thumbnails for the chosen images, released when the list changes.
  const previews = useMemo(
    () => files.map((f) => (isImageMime(f.type) ? URL.createObjectURL(f) : null)),
    [files],
  );
  useEffect(() => () => previews.forEach((u) => u && URL.revokeObjectURL(u)), [previews]);

  /** Adds files to the list, keeping the limits (count, type, size) visible to the user. */
  function addFiles(incoming: File[]) {
    if (incoming.length === 0) return;
    setMsg(null);
    const accepted: File[] = [];
    let error: string | null = null;
    for (const file of incoming) {
      if (!ATTACHMENT_MIME_TYPES.includes(file.type)) {
        error = `« ${file.name} » : type non accepté (images PNG, JPEG, WebP ou PDF).`;
      } else if (file.size > MAX_ATTACHMENT_BYTES) {
        error = `« ${file.name} » est trop volumineux (${MAX_MB} Mo max par fichier).`;
      } else {
        accepted.push(file);
      }
    }
    const room = MAX_ATTACHMENTS - files.length;
    if (accepted.length > room) error = `${MAX_ATTACHMENTS} fichiers maximum par ticket.`;
    setFiles((prev) => [...prev, ...accepted.slice(0, Math.max(0, room))]);
    if (error) setMsg({ type: "err", text: error });
  }

  // Ctrl+V of a screenshot anywhere in the form attaches it: the quickest way to
  // show an error without saving a file first.
  function handlePaste(e: React.ClipboardEvent) {
    const pasted = [...e.clipboardData.files].filter((f) => f.type.startsWith("image/"));
    if (pasted.length === 0) return; // plain text paste: leave it alone
    e.preventDefault();
    addFiles(
      pasted.map((f, i) =>
        // Clipboard screenshots all arrive as "image.png": give them a readable name.
        f.name === "image.png" ? new File([f], `capture-${Date.now()}-${i + 1}.png`, { type: f.type }) : f,
      ),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return; // no double submit
    setLoading(true);
    setMsg(null);
    try {
      const body = new FormData(ref.current!);
      body.delete("files"); // the visible file input is only a picker: the list below is the truth
      for (const file of files) body.append("files", file);

      const res = await fetch("/api/tickets", { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setMsg({ type: "err", text: json.error ?? "Erreur lors de l'envoi." });
        return;
      }
      setMsg({ type: "ok", text: "Ticket envoyé. Les RH vous répondront ici." });
      ref.current?.reset();
      setFiles([]);
      router.refresh();
    } catch {
      // Network down, server restarting…: never leave the form stuck.
      setMsg({ type: "err", text: "Impossible de contacter le serveur. Réessayez dans un instant." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form ref={ref} onSubmit={handleSubmit} onPaste={handlePaste} className="space-y-4">
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

      <Field
        label="Fichiers d'écran"
        hint={`Captures d'écran, images ou PDF pour aider les RH à comprendre. ${MAX_ATTACHMENTS} fichiers maximum, ${MAX_MB} Mo chacun. Vous pouvez aussi coller une capture avec Ctrl+V.`}
      >
        {(props) => (
          <div className="space-y-3">
            <input
              {...props}
              ref={fileRef}
              name="files"
              type="file"
              multiple
              accept={ATTACHMENT_MIME_TYPES.join(",")}
              onChange={(e) => {
                addFiles([...(e.target.files ?? [])]);
                e.target.value = ""; // allow picking the same file again after removing it
              }}
              className="sr-only"
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={files.length >= MAX_ATTACHMENTS}
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus className="size-4" aria-hidden />
              Ajouter des fichiers
            </Button>

            {files.length > 0 && (
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {files.map((file, i) => (
                  <li
                    key={`${file.name}-${file.size}-${i}`}
                    className="group relative overflow-hidden rounded-xl bg-slate-50 ring-1 ring-inset ring-slate-200"
                  >
                    {previews[i] ? (
                      // eslint-disable-next-line @next/next/no-img-element -- local blob preview, not optimisable
                      <img src={previews[i]!} alt={file.name} className="h-24 w-full object-cover" />
                    ) : (
                      <div className="grid h-24 place-items-center text-slate-400">
                        <FileText className="size-8" aria-hidden />
                      </div>
                    )}
                    <p className="truncate px-2 py-1.5 text-[11px] text-slate-600" title={file.name}>
                      {file.name}
                    </p>
                    <button
                      type="button"
                      onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                      aria-label={`Retirer ${file.name}`}
                      className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-slate-900/70 text-white transition-colors hover:bg-slate-900"
                    >
                      <X className="size-3.5" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Field>

      {msg?.type === "err" && <FormMessage type="err">{msg.text}</FormMessage>}

      <Button type="submit" loading={loading} fullWidth>
        Envoyer aux RH
      </Button>
    </form>
  );
}
