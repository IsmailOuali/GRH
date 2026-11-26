/**
 * "Signaler un changement": the blocks of the fiche a salarié may ask to change,
 * and the rules each proposed value must pass. Pure and client-safe — read by the
 * form (instant feedback) and by the server actions (the real enforcement).
 *
 * Each topic maps to columns of EmployeeDossier. Labels, input types and
 * options come from the dossier schema, so they can never drift from it.
 */

import {
  SCALAR_FIELDS,
  SITUATION_FAMILIALE_OPTIONS,
  type DossierField,
} from "@/lib/dossiers/schema";

export type ChangeTopic = {
  value: string;
  label: string;
  /** Dossier columns this topic changes. */
  fields: string[];
};

export const CHANGE_TOPICS: ChangeTopic[] = [
  { value: "ADRESSE", label: "Adresse", fields: ["adresseResidentielle"] },
  { value: "TELEPHONE", label: "Téléphone", fields: ["telephonePersonnel"] },
  { value: "SITUATION_FAMILIALE", label: "Situation familiale", fields: ["situationFamiliale", "nombreEnfants"] },
  { value: "RIB", label: "RIB", fields: ["rib"] },
  {
    value: "CONTACT_URGENCE",
    label: "Contact d'urgence",
    fields: ["contactUrgenceNom", "contactUrgenceLien", "contactUrgenceTelephone"],
  },
];

export const TOPIC_LABELS: Record<string, string> = Object.fromEntries(
  CHANGE_TOPICS.map((t) => [t.value, t.label]),
);

export function getTopic(value: string): ChangeTopic | undefined {
  return CHANGE_TOPICS.find((t) => t.value === value);
}

/** The dossier field definitions (label, type, options) of a topic, in order. */
export function topicFields(topic: ChangeTopic): DossierField[] {
  return topic.fields
    .map((name) => SCALAR_FIELDS.find((f) => f.name === name))
    .filter((f): f is DossierField => Boolean(f));
}

/** Hints shown under a field of the form. */
export const FIELD_HINTS: Record<string, string> = {
  rib: "24 chiffres, comme sur votre relevé d'identité bancaire (les espaces sont ignorés).",
  nombreEnfants: "Mettez 0 si vous n'avez pas d'enfant.",
};

export const MAX_CHANGE_COMMENT = 300;

const MAX_ADDRESS = 300;
const MAX_NAME = 100;
const MAX_LIEN = 60;

function phoneError(value: string, label: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (!/^\+?[0-9 ().-]+$/.test(value) || digits.length < 8 || digits.length > 15)
    return `${label} invalide (8 à 15 chiffres).`;
  return null;
}

export type ChangeValidation = { values: Record<string, string> } | { error: string };

/**
 * Checks and normalises the values proposed for a topic. `raw` is keyed by
 * dossier column. Returns exactly the topic's columns, normalised the same way
 * the dossier stores them (compact RIB, whole-number children count).
 */
export function validateChange(topicValue: string, raw: Record<string, string>): ChangeValidation {
  const v = (key: string) => (raw[key] ?? "").trim();

  switch (topicValue) {
    case "ADRESSE": {
      const adresse = v("adresseResidentielle");
      if (!adresse) return { error: "L'adresse est obligatoire." };
      if (adresse.length > MAX_ADDRESS) return { error: `L'adresse ne peut pas dépasser ${MAX_ADDRESS} caractères.` };
      return { values: { adresseResidentielle: adresse } };
    }
    case "TELEPHONE": {
      const tel = v("telephonePersonnel");
      const err = phoneError(tel, "Numéro de téléphone");
      return err ? { error: err } : { values: { telephonePersonnel: tel } };
    }
    case "SITUATION_FAMILIALE": {
      const situation = v("situationFamiliale");
      if (!SITUATION_FAMILIALE_OPTIONS.some((o) => o.value === situation))
        return { error: "Choisissez votre situation familiale." };
      const kids = /^\d{1,2}$/.exec(v("nombreEnfants"));
      if (!kids || Number(kids[0]) > 20) return { error: "Nombre d'enfants invalide (0 à 20)." };
      return { values: { situationFamiliale: situation, nombreEnfants: String(Number(kids[0])) } };
    }
    case "RIB": {
      const rib = v("rib").replace(/[\s.-]+/g, "");
      if (!/^\d{24}$/.test(rib)) return { error: "Le RIB doit comporter exactement 24 chiffres." };
      return { values: { rib } };
    }
    case "CONTACT_URGENCE": {
      const nom = v("contactUrgenceNom");
      const lien = v("contactUrgenceLien");
      const tel = v("contactUrgenceTelephone");
      if (!nom) return { error: "Le nom du contact est obligatoire." };
      if (nom.length > MAX_NAME) return { error: `Le nom ne peut pas dépasser ${MAX_NAME} caractères.` };
      if (!lien) return { error: "Le lien de parenté est obligatoire." };
      if (lien.length > MAX_LIEN) return { error: `Le lien de parenté ne peut pas dépasser ${MAX_LIEN} caractères.` };
      const err = phoneError(tel, "Téléphone du contact");
      if (err) return { error: err };
      return { values: { contactUrgenceNom: nom, contactUrgenceLien: lien, contactUrgenceTelephone: tel } };
    }
    default:
      return { error: "Type de changement invalide." };
  }
}

/** "•••• •••• •••• •••• •••• 1234" — the RIB is never shown in full on screen. */
export function maskRib(rib: string | null | undefined): string {
  const digits = (rib ?? "").replace(/\D/g, "");
  if (digits.length < 4) return "";
  return `•••• •••• •••• •••• •••• ${digits.slice(-4)}`;
}
