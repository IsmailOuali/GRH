export type FieldType = 'text' | 'date' | 'number';

export interface TemplateField {
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
  dynamicOptions?: string; // key into DocumentForm's dynamicData prop
  readOnly?: boolean;
  computedFrom?: [string, string]; // [startDateField, endDateField] → business days
  computeReturnDate?: string; // name of the end-date field → next business day (date de reprise)
  /** Pre-fill with today's date when the form opens. Stays editable. */
  defaultToday?: boolean;
}

export interface TemplateConfig {
  id: string;
  label: string;
  templatePath: string;
  fields: TemplateField[];
  /** Not user-selectable on the Documents page — kept here as the render
   *  source for another flow (or for resolving pre-existing requests). */
  hidden?: boolean;
}

export const TEMPLATES: TemplateConfig[] = [
  {
    id: 'conge-payes',
    label: 'Demande de Congés Payés',
    templatePath: 'document-templates/conge-payes/template.html',
    // Generated automatically on CP leave-request approval (see conges/actions.ts
    // reviewLeave) — no longer offered as a standalone Documents template.
    hidden: true,
    fields: [
      { name: 'nom_salarie',   label: 'Nom du salarié',     type: 'text',   required: true, dynamicOptions: 'employees' },
      { name: 'date_demande',  label: 'Date de demande',    type: 'date',   required: true },
      { name: 'date_debut',    label: 'Date de début',      type: 'date',   required: true },
      { name: 'date_fin',      label: 'Date de fin',        type: 'date',   required: true },
      { name: 'nombre_jours',  label: 'Nombre de jours',    type: 'number', required: true, readOnly: true, computedFrom: ['date_debut', 'date_fin'] },
      { name: 'date_reprise',  label: 'Date de reprise',    type: 'date',   required: true, readOnly: true, computeReturnDate: 'date_fin' },
    ],
  },
  {
    id: 'attestation-travail',
    label: 'Attestation de Travail',
    templatePath: 'document-templates/attestation-travail/template.html',
    fields: [
      { name: 'date_attestation', label: "Date de l'attestation",       type: 'date', required: true, defaultToday: true },
      { name: 'nom_prenom',       label: 'Nom et Prénom',               type: 'text', required: true },
      { name: 'civilite',         label: 'Civilité',                    type: 'text', required: true, options: ['Monsieur', 'Madame'] },
      { name: 'type_contrat',     label: 'Type de contrat',             type: 'text', required: true, options: ['CDI', 'CDD'] },
      { name: 'intitule_poste',   label: 'Intitulé du poste',           type: 'text', required: true },
      { name: 'date_integration', label: "Date d'intégration",          type: 'date', required: true },
      { name: 'date_signature',   label: 'Date de signature',           type: 'date', required: true, defaultToday: true },
    ],
  },
  {
    id: 'attestation-salaire',
    label: 'Attestation de Salaire',
    templatePath: 'document-templates/attestation-salaire/template.html',
    fields: [
      { name: 'civilite',         label: 'Civilité',                    type: 'text',   required: true, options: ['Monsieur', 'Madame'] },
      { name: 'nom_prenom',       label: 'Nom et Prénom',               type: 'text',   required: true },
      { name: 'numero_cin',       label: 'Numéro CIN',                  type: 'text',   required: true },
      { name: 'numero_cnss',      label: 'Numéro CNSS',                 type: 'text',   required: true },
      { name: 'intitule_poste',   label: 'Intitulé du poste',           type: 'text',   required: true },
      { name: 'date_integration', label: "Date d'intégration",          type: 'date',   required: true },
      { name: 'montant_salaire',  label: 'Montant du salaire (DH)',     type: 'number', required: true },
      { name: 'date_signature',   label: 'Date de signature',           type: 'date',   required: true, defaultToday: true },
    ],
  },
];

export const TEMPLATES_MAP: Record<string, TemplateConfig> = Object.fromEntries(
  TEMPLATES.map((t) => [t.id, t]),
);
