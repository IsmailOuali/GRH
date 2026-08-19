/**
 * Single source of truth for the "Dossier Salarié & Fiche d'Identité Interne".
 *
 * Drives three consumers, so they can never drift:
 *  - the label-anchored PDF parser  (src/lib/dossiers/extract.ts)
 *  - the editable form              (src/components/DossierForm.tsx)
 *  - the regeneration HTML template (src/lib/dossiers/render-html.ts)
 *
 * The two structurally-different fields — `outilsAttribues` (string array) and
 * `pieces` (table) — are handled explicitly by each consumer and are NOT part of
 * the scalar SCALAR_FIELDS list below.
 */

export type SectionId =
  | "informations-personnelles"
  | "situation-professionnelle"
  | "coordonnees-acces-materiel"
  | "contact-urgence"
  | "pieces-justificatives";

export interface DossierSection {
  id: SectionId;
  title: string;
}

export const SECTIONS: DossierSection[] = [
  { id: "informations-personnelles", title: "Informations Personnelles" },
  { id: "situation-professionnelle", title: "Situation Professionnelle" },
  { id: "coordonnees-acces-materiel", title: "Coordonnées / Accès / Matériel" },
  { id: "contact-urgence", title: "Contact d'Urgence" },
  { id: "pieces-justificatives", title: "Pièces Justificatives" },
];

export type FieldType = "text" | "date" | "textarea" | "select";

export interface SelectOption {
  value: string;
  label: string;
}

export interface DossierField {
  /** Key in the flat scalar data object and the Prisma column name. */
  name: string;
  /** French display label — mirrors the source PDF wording. */
  label: string;
  section: SectionId;
  type: FieldType;
  /** Options for `select` fields. The stored value is the canonical code. */
  options?: SelectOption[];
  /**
   * Labels to anchor on when parsing the source PDF. First confident match wins.
   * Include realistic aliases so small wording differences still resolve.
   */
  parseLabels: string[];
  /** Parse this field by detecting a ticked "[X] Option" checkbox group. */
  checkbox?: boolean;
}

export const TYPE_CONTRAT_OPTIONS: SelectOption[] = [
  { value: "CDI", label: "CDI" },
  { value: "CDD", label: "CDD" },
  { value: "STAGE", label: "Stage" },
  { value: "AUTRE", label: "Autre" },
];

export const STATUT_ESSAI_OPTIONS: SelectOption[] = [
  { value: "EN_COURS", label: "En cours" },
  { value: "VALIDEE", label: "Validée" },
  { value: "RENOUVELEE", label: "Renouvelée" },
];

/**
 * Scalar (single-value) fields. Order = display order within each section.
 * `parseLabels` are the EXACT labels from the Fair'Up intake form (longest /
 * most specific first). The parser slices the value that follows each label.
 */
export const SCALAR_FIELDS: DossierField[] = [
  // ── 1 · Informations Personnelles du Salarié ──────────────────────────────
  { name: "nom", label: "Nom", section: "informations-personnelles", type: "text", parseLabels: ["Nom"] },
  { name: "prenom", label: "Prénom", section: "informations-personnelles", type: "text", parseLabels: ["Prénom"] },
  { name: "dateNaissance", label: "Date de naissance", section: "informations-personnelles", type: "date", parseLabels: ["Date de naissance"] },
  { name: "nationalite", label: "Nationalité", section: "informations-personnelles", type: "text", parseLabels: ["Nationalité"] },
  { name: "numeroCin", label: "Numéro CIN", section: "informations-personnelles", type: "text", parseLabels: ["Numéro CIN"] },
  { name: "adresseResidentielle", label: "Adresse résidentielle", section: "informations-personnelles", type: "textarea", parseLabels: ["Adresse résidentielle"] },
  { name: "telephonePersonnel", label: "Téléphone personnel", section: "informations-personnelles", type: "text", parseLabels: ["Téléphone personnel"] },
  { name: "emailPersonnel", label: "Adresse email personnelle", section: "informations-personnelles", type: "text", parseLabels: ["Adresse email personnelle"] },
  { name: "numeroCnss", label: "Numéro CNSS", section: "informations-personnelles", type: "text", parseLabels: ["Numéro CNSS"] },

  // ── 2 · Situation Professionnelle chez Fair'UP ────────────────────────────
  { name: "matricule", label: "Matricule Salarié", section: "situation-professionnelle", type: "text", parseLabels: ["Matricule Salarié"] },
  { name: "poste", label: "Intitulé du poste", section: "situation-professionnelle", type: "text", parseLabels: ["Intitulé du poste"] },
  { name: "departement", label: "Département / Service", section: "situation-professionnelle", type: "text", parseLabels: ["Département / Service", "Département"] },
  { name: "manager", label: "Supérieur hiérarchique (N+1)", section: "situation-professionnelle", type: "text", parseLabels: ["Supérieur hiérarchique (N+1)", "Supérieur hiérarchique"] },
  { name: "dateIntegration", label: "Date d'intégration", section: "situation-professionnelle", type: "date", parseLabels: ["Date d'intégration"] },
  { name: "typeContrat", label: "Type de contrat", section: "situation-professionnelle", type: "select", options: TYPE_CONTRAT_OPTIONS, checkbox: true, parseLabels: ["Type de contrat"] },
  { name: "statutPeriodeEssai", label: "Statut période d'essai", section: "situation-professionnelle", type: "select", options: STATUT_ESSAI_OPTIONS, checkbox: true, parseLabels: ["Statut période d'essai"] },

  // ── 3 · Coordonnées, Accès et Matériel Professionnel ──────────────────────
  { name: "emailPro", label: "Adresse email pro", section: "coordonnees-acces-materiel", type: "text", parseLabels: ["Adresse email pro"] },
  { name: "identifiantRingover", label: "Identifiant Ringover", section: "coordonnees-acces-materiel", type: "text", parseLabels: ["Identifiant Ringover"] },
  { name: "extensionLigne", label: "Extension / Ligne directe", section: "coordonnees-acces-materiel", type: "text", parseLabels: ["Extension / Ligne directe", "Extension"] },
  { name: "materielInformatique", label: "Matériel informatique affecté", section: "coordonnees-acces-materiel", type: "textarea", parseLabels: ["Matériel informatique affecté", "Matériel informatique"] },

  // ── 4 · Contact d'Urgence ─────────────────────────────────────────────────
  { name: "contactUrgenceNom", label: "Nom & Prénom", section: "contact-urgence", type: "text", parseLabels: ["Nom & Prénom"] },
  { name: "contactUrgenceLien", label: "Lien de parenté", section: "contact-urgence", type: "text", parseLabels: ["Lien de parenté"] },
  { name: "contactUrgenceTelephone", label: "Téléphone d'urgence", section: "contact-urgence", type: "text", parseLabels: ["Téléphone d'urgence"] },
];

export const SCALAR_FIELDS_BY_SECTION: Record<SectionId, DossierField[]> =
  SECTIONS.reduce((acc, s) => {
    acc[s.id] = SCALAR_FIELDS.filter((f) => f.section === s.id);
    return acc;
  }, {} as Record<SectionId, DossierField[]>);

export const SCALAR_FIELD_NAMES = SCALAR_FIELDS.map((f) => f.name);

// ── Pièces Justificatives (checklist table) ──────────────────────────────────
export interface DossierPiece {
  document: string;
  statut: string; // "Reçu" | "En attente"
  dateReception: string; // yyyy-mm-dd or ""
}

export const PIECE_STATUT_OPTIONS = ["Reçu", "En attente"] as const;

/** Canonical checklist rows — exact wording from the Fair'Up intake form. */
export const PIECE_DOCUMENTS: string[] = [
  "Copie de la pièce d'identité (CNI / Passeport)",
  "Curriculum Vitae (CV) mis à jour",
  "Copie des diplômes ou attestations",
  "Relevé d'Identité Bancaire (RIB)",
  "Contrat de travail Fair'UP signé",
  "Attestation d'immatriculation (Sécurité Sociale / CNSS)",
];

// ── Outils attribués (checkbox group on the form) ─────────────────────────────
/**
 * Labels anchoring the outils row in the source PDF — first entry is
 * canonical (used when the app renders its own PDF); the rest are aliases
 * so re-uploading an older regenerated dossier still resolves.
 */
export const OUTILS_LABELS = ["Autres outils attribués", "Outils attribués"];
export const OUTILS_LABEL = OUTILS_LABELS[0];
/** Checkbox options on the form; the parser pre-fills any that are ticked. */
export const OUTIL_SUGGESTIONS: string[] = [
  "Logiciel innovaweb",
  "CRM",
  "Slack / Teams",
];

/**
 * Section headers and table headers — used by the parser purely as boundaries so
 * a field value can't bleed into the next section. Their own segments are ignored.
 */
export const STOP_PHRASES: string[] = [
  "DOSSIER SALARIÉ & FICHE D'IDENTITÉ INTERNE",
  "STRICTEMENT CONFIDENTIEL",
  "Informations Personnelles du Salarié",
  // Company-agnostic: matches "…chez Fair'UP" and "…CHEZ FAIR2UP" alike.
  "Situation Professionnelle",
  "Coordonnées, Accès et Matériel Professionnel",
  "Contact d'Urgence",
  "Pièces Justificatives (Check-list RH)",
  "Document demandé",
  "Date de réception",
  // Page footer.
  "Document Interne Strictement Confidentiel",
  // Short forms — the app's OWN regenerated PDF (render-html.ts) uses these
  // exact SECTIONS titles, not the longer original-intake-form wording above.
  // Re-uploading a previously-generated dossier must still parse cleanly.
  "Informations Personnelles",
  "Coordonnées / Accès / Matériel",
  "Pièces Justificatives",
];

// ── The full structured dossier as the form / API exchange it ─────────────────
export interface DossierData {
  /** All scalar fields keyed by name. Missing values are "". */
  fields: Record<string, string>;
  outilsAttribues: string[];
  pieces: DossierPiece[];
}

export function emptyDossierData(): DossierData {
  const fields: Record<string, string> = {};
  for (const f of SCALAR_FIELDS) fields[f.name] = "";
  return {
    fields,
    outilsAttribues: [],
    pieces: PIECE_DOCUMENTS.map((document) => ({ document, statut: "En attente", dateReception: "" })),
  };
}
