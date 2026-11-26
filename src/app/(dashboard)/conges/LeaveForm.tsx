"use client";

import { useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { nextBusinessDayIso, formatFrIso, toIso } from "@/lib/dates";
import { useAidHolidays } from "@/components/AidProvider";
import { JUSTIFICATIF_MAX_BYTES, allowsJustificatif } from "@/lib/leave-justificatif";
import { Button } from "@/components/ui/Button";
import { Field, FormMessage } from "@/components/ui/Field";
import { controlClass } from "@/components/ui/control";
import {
  countLeaveDays,
  STANDARD_LEAVE_TYPES,
  ABSENCE_LEAVE_TYPES,
  SPECIAL_LEAVE_TYPES,
  isSpecialLeave,
  needsJustificatif,
  specialLeaveEntitlement,
  specialLeaveFreeDays,
} from "@/lib/leave-types";
import {
  MAX_COMMENT_LENGTH,
  MAX_DATE,
  MIN_DATE,
  validateEventDate,
  validateLeaveDates,
} from "@/lib/leave-validation";
import { submitLeaveRequest } from "./actions";
import { useFeedback } from "@/lib/toast";

const JUSTIFICATIF_ACCEPT = "application/pdf,image/png,image/jpeg,image/webp";

export function LeaveForm() {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Held in state, NOT in the <form> data: the file must not travel through the
  // server action (1 MB body cap) — it is sent to the justificatif route afterwards.
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useFeedback();
  const [type, setType] = useState(STANDARD_LEAVE_TYPES[0].value);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [eventDate, setEventDate] = useState("");

  const special = isSpecialLeave(type);
  const absence = ABSENCE_LEAVE_TYPES.some((t) => t.value === type);
  const canAttach = allowsJustificatif(type);
  const droit = specialLeaveEntitlement(type);
  const freeDays = specialLeaveFreeDays(type);

  // Rule violations on the dates typed so far. Checked BEFORE counting days:
  // the counting loop walks every day of the range, so an absurd year (a date
  // input accepts up to 275760) must never reach it.
  const dateError = useMemo(
    () => (startDate && endDate ? validateLeaveDates(new Date(startDate), new Date(endDate)) : null),
    [startDate, endDate],
  );
  const eventError = useMemo(
    () =>
      special && eventDate && startDate && endDate && !dateError
        ? validateEventDate(new Date(eventDate), new Date(startDate), new Date(endDate))
        : null,
    [special, eventDate, startDate, endDate, dateError],
  );

  const aidHolidays = useAidHolidays();
  const aidDates = useMemo(() => new Set(aidHolidays.map((h) => h.date)), [aidHolidays]);
  // Aïd days falling in the period typed so far: shown, so the count is explained.
  const aidInPeriod = useMemo(() => {
    if (!startDate || !endDate || dateError) return [];
    const from = toIso(new Date(startDate));
    const to = toIso(new Date(endDate));
    return aidHolidays.filter((h) => h.date >= from && h.date <= to);
  }, [aidHolidays, startDate, endDate, dateError]);

  const days = useMemo(() => {
    if (!startDate || !endDate || dateError) return null;
    return countLeaveDays(type, new Date(startDate), new Date(endDate), aidDates);
  }, [type, startDate, endDate, dateError, aidDates]);

  // A congé spécial can never exceed its droit. The server also enforces it
  // across the other requests of the same event; this just stops the obvious.
  const overCap = special && droit !== undefined && days !== null && days > droit;
  const blocked = overCap || Boolean(dateError) || Boolean(eventError) || (canAttach && Boolean(fileError));

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    setFileError(null);
    if (picked && !JUSTIFICATIF_ACCEPT.split(",").includes(picked.type)) {
      setFileError("Type de fichier non accepté (PDF ou image).");
    } else if (picked && (picked.size === 0 || picked.size > JUSTIFICATIF_MAX_BYTES)) {
      setFileError("Fichier vide ou trop volumineux (15 Mo max).");
    }
    setFile(picked);
  }

  function clearFile() {
    setFile(null);
    setFileError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  // Date de reprise = premier jour ouvré après la date de fin (verrouillée).
  const returnDate = useMemo(
    () => (endDate ? nextBusinessDayIso(endDate, aidDates) : ""),
    [endDate, aidDates],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading || blocked) return; // no double submit, no known-invalid submit
    setLoading(true);
    setMsg(null);
    try {
      const result = await submitLeaveRequest(new FormData(ref.current!));
      if (result.success) {
        // Optional justificatif: sent once the request exists. A failure here never
        // cancels the request — it is already saved — it is only reported.
        let attachError: string | null = null;
        const toSend = canAttach ? file : null;
        if (toSend) {
          try {
            const body = new FormData();
            body.append("file", toSend);
            body.append("atSubmission", "1");
            const res = await fetch(`/api/leaves/${result.id}/justificatif`, { method: "POST", body });
            if (!res.ok) {
              const json = (await res.json().catch(() => ({}))) as { error?: string };
              attachError = json.error ?? "Échec de l'envoi.";
            }
          } catch {
            attachError = "Impossible de contacter le serveur.";
          }
        }

        if (attachError) {
          setMsg({
            type: "err",
            text: needsJustificatif(type)
              ? `Demande envoyée, mais le justificatif n'a pas pu être joint (${attachError}) Vous pouvez le déposer depuis l'historique de vos demandes.`
              : `Demande envoyée, mais le justificatif n'a pas pu être joint (${attachError}) Contactez les RH pour le leur transmettre.`,
          });
        } else {
          setMsg({ type: "ok", text: toSend ? "Demande envoyée avec son justificatif." : "Demande envoyée avec succès." });
        }
        ref.current?.reset();
        clearFile();
        setType(STANDARD_LEAVE_TYPES[0].value);
        setStartDate("");
        setEndDate("");
        setEventDate("");
        router.refresh(); // show the justificatif in the history
      } else {
        setMsg({ type: "err", text: result.error ?? "Erreur." });
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
      <Field label="Type" required>
        {(props) => (
          <select
            {...props}
            name="type"
            required
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              // The file input disappears for types without a justificatif: drop the file with it.
              if (!allowsJustificatif(e.target.value)) clearFile();
            }}
            className={controlClass}
          >
            <optgroup label="Congés">
              {STANDARD_LEAVE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </optgroup>
            <optgroup label="Absences (maladie, urgence…)">
              {ABSENCE_LEAVE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </optgroup>
            <optgroup label="Congés spéciaux (événements familiaux)">
              {SPECIAL_LEAVE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </optgroup>
          </select>
        )}
      </Field>

      {absence && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-inset ring-amber-200">
          {needsJustificatif(type) ? (
            <>
              Vous pouvez déclarer cette absence <strong>après coup</strong> (dates passées acceptées).{" "}
              Le justificatif est <strong>optionnel</strong> : joignez-le ci-dessous ou{" "}
              <strong>déposez-le plus tard</strong> depuis l&apos;historique de vos demandes.
              Cette absence n&apos;est pas déduite de votre solde CP.
            </>
          ) : (
            <>
              Absence <strong>non justifiée</strong> : elle est enregistrée telle quelle, sans justificatif, et
              n&apos;est pas déduite de votre solde CP. Si vous avez un justificatif, choisissez plutôt
              « Absence justifiée ».
            </>
          )}
        </p>
      )}

      {special && (
        <>
<p className="rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-800 ring-1 ring-inset ring-sky-200">
  Congé spécial : <strong>{droit} jour{droit && droit > 1 ? "s" : ""} maximum</strong> peuvent être accordés pour cet événement (vous pouvez demander moins de jours).
  {" "}
  {freeDays !== undefined && droit !== undefined ? (
    <>
      <strong>
        {freeDays} jour{freeDays > 1 ? "s" : ""} sont accordés sans déduction du solde de congés payés (CP), et {droit - freeDays} jour{droit - freeDays > 1 ? "s" : ""} sont déduits de ce solde.
      </strong>
    </>
  ) : (
    <>
      Ces jours ne sont <strong>pas déduits</strong> de votre solde de congés payés (CP).
    </>
  )}
  {" "}
  Le samedi est inclus dans le décompte. Un justificatif pourra vous être demandé.
</p>
          <Field label="Date de l'événement" required hint="Sert à regrouper les demandes d'un même événement.">
            {(props) => (
              <input
                {...props}
                name="eventDate"
                type="date"
                required
                min={MIN_DATE}
                max={MAX_DATE}
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className={controlClass}
              />
            )}
          </Field>
        </>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Date de début" required>
          {(props) => (
            <input
              {...props}
              name="startDate"
              type="date"
              required
              min={MIN_DATE}
              max={MAX_DATE}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={controlClass}
            />
          )}
        </Field>
        <Field label="Date de fin" required>
          {(props) => (
            <input
              {...props}
              name="endDate"
              type="date"
              required
              min={startDate || MIN_DATE}
              max={MAX_DATE}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={controlClass}
            />
          )}
        </Field>
      </div>

      {/* Derived, non-editable: shown as a summary rather than as two dead
          inputs, so nothing invites a click that does nothing. */}
      <dl className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 ring-1 ring-inset ring-slate-200/70">
        <div>
          <dt className="text-xs font-medium text-slate-500">
            {special ? "Jours comptés (lun–sam)" : "Jours ouvrés"}
          </dt>
          <dd className="mt-0.5 text-sm font-medium tabular-nums text-slate-800">
            {days === null ? "—" : `${days} jour${days > 1 ? "s" : ""}`}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500">Date de reprise</dt>
          <dd className="mt-0.5 text-sm font-medium tabular-nums text-slate-800">
            {returnDate ? formatFrIso(returnDate) : "—"}
          </dd>
        </div>
      </dl>

      {aidInPeriod.length > 0 && (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-900 ring-1 ring-inset ring-rose-200">
          Non décompté : {aidInPeriod.map((h) => `${formatFrIso(h.date)} · ${h.label}`).join(", ")}.
          {aidInPeriod.some((h) => h.label.includes("prévisionnel")) &&
            " Le décompte sera ajusté si la date change à la confirmation."}
        </p>
      )}

      {dateError && <FormMessage type="err">{dateError}</FormMessage>}
      {eventError && <FormMessage type="err">{eventError}</FormMessage>}

      {overCap && (
        <FormMessage type="err">
          Cette période compte {days} jours, mais le droit est de {droit} jour{droit! > 1 ? "s" : ""} maximum.
          Raccourcissez la période.
        </FormMessage>
      )}

      <Field
        label="Commentaire"
        hint={special ? "Précisez l'événement (lien de parenté, date…)." : "Optionnel — précisez le contexte si utile."}
      >
        {(props) => (
          <textarea {...props} name="comment" rows={3} maxLength={MAX_COMMENT_LENGTH} className={controlClass} />
        )}
      </Field>

      {canAttach && (
        <Field
          label="Justificatif"
          hint="Optionnel — PDF ou image (JPG, PNG, WebP), 15 Mo maximum."
          error={fileError ?? undefined}
        >
          {(props) => (
            <input
              {...props}
              ref={fileRef}
              type="file"
              accept={JUSTIFICATIF_ACCEPT}
              onChange={handleFile}
              className={`${controlClass} file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1 file:text-sm file:font-medium file:text-brand-700`}
            />
          )}
        </Field>
      )}

      {msg?.type === "err" && <FormMessage type="err">{msg.text}</FormMessage>}

      <Button type="submit" loading={loading} disabled={blocked} fullWidth>
        Soumettre la demande
      </Button>
    </form>
  );
}
