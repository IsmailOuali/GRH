/**
 * The leave types a salarié can request — defined once, read by the form, the
 * server action, the history tables and the planning.
 *
 * Two families:
 *  - balance leaves (CP, RTT) are checked against and deducted from the solde;
 *  - everything else (maladie, sans solde, congés spéciaux) never touches it.
 *
 * Congés spéciaux are the "congés pour événements familiaux" of the Code du
 * travail marocain (art. 274). `droit` is the usual entitlement in jours — it is
 * shown as guidance and flagged when exceeded, but never enforced: the manager
 * validating the request has the last word (convention collective, justificatif).
 * Check the figures against your own convention before relying on them.
 */

export type LeaveTypeDef = {
  value: string;
  label: string;
  /** Usual entitlement in jours, congés spéciaux only. */
  droit?: number;
};

export const STANDARD_LEAVE_TYPES: LeaveTypeDef[] = [
  { value: "CP", label: "Congés Payés" },
  { value: "RTT", label: "RTT" },
  { value: "MALADIE", label: "Maladie" },
  { value: "SANS_SOLDE", label: "Sans Solde" },
];

export const SPECIAL_LEAVE_TYPES: LeaveTypeDef[] = [
  { value: "SPECIAL_MARIAGE", label: "Mariage du salarié", droit: 4 },
  { value: "SPECIAL_MARIAGE_ENFANT", label: "Mariage d'un enfant", droit: 2 },
  { value: "SPECIAL_NAISSANCE", label: "Naissance / adoption", droit: 3 },
  { value: "SPECIAL_DECES", label: "Décès d'un proche (conjoint, enfant, parent, frère/sœur)", droit: 3 },
  { value: "SPECIAL_CIRCONCISION", label: "Circoncision d'un enfant", droit: 2 },
];

export const ALL_LEAVE_TYPES: LeaveTypeDef[] = [...STANDARD_LEAVE_TYPES, ...SPECIAL_LEAVE_TYPES];

export const LEAVE_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  ALL_LEAVE_TYPES.map((t) => [t.value, t.label]),
);

export function isSpecialLeave(type: string): boolean {
  return SPECIAL_LEAVE_TYPES.some((t) => t.value === type);
}

export function isValidLeaveType(type: string): boolean {
  return ALL_LEAVE_TYPES.some((t) => t.value === type);
}

export function specialLeaveEntitlement(type: string): number | undefined {
  return SPECIAL_LEAVE_TYPES.find((t) => t.value === type)?.droit;
}
