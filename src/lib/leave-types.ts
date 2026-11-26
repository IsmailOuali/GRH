/**
 * The leave types a salarié can request — defined once, read by the form, the
 * server action, the history tables and the planning.
 *
 * Deducted from the CP solde: CP, plus the non-free part of the mariage du
 * salarié (2 of its 4 jours are free, 2 come from CP — see `joursNonDeduits`).
 * Never deducted: maladie, sans solde and the other congés spéciaux.
 *
 * Congés spéciaux are the "congés pour événements familiaux" of the Code du
 * travail marocain (art. 274). `droit` is the MAXIMUM in jours for ONE event:
 * a salarié may ask for fewer days, never more. The cap is enforced across all
 * the pending/approved requests that share the same type and event date, so an
 * event cannot be split into several requests to get past it. Saturday counts
 * as a day for these leaves (Monday–Saturday), unlike the other types.
 */

import { businessDaysBetween, workingDaysMonSatBetween } from "@/lib/dates";

export type LeaveTypeDef = {
  value: string;
  label: string;
  /** Maximum jours for one event, congés spéciaux only. */
  droit?: number;
  /**
   * Congés spéciaux only: how many of the `droit` jours are granted for free.
   * The rest of the event's jours are taken from the CP solde. When absent, the
   * whole droit is free.
   */
  joursNonDeduits?: number;
  /**
   * Absences only: a justificatif (certificat, convocation…) is expected. It can
   * be filed after the fact — the request is never blocked for lack of it.
   */
  needsJustificatif?: boolean;
};

export const STANDARD_LEAVE_TYPES: LeaveTypeDef[] = [
  { value: "CP", label: "Congés Payés" },
  { value: "SANS_SOLDE", label: "Sans Solde" },
];

/**
 * Absences, declared as they happen (unplanned: maladie, urgence…). Justified
 * ones expect a justificatif that may arrive after the declaration; an
 * unjustified one is only recorded. None of them is deducted from the CP solde.
 */
export const ABSENCE_LEAVE_TYPES: LeaveTypeDef[] = [
  { value: "MALADIE", label: "Maladie", needsJustificatif: true },
  { value: "ABSENCE_JUSTIFIEE", label: "Absence justifiée (urgence, imprévu…)", needsJustificatif: true },
  { value: "ABSENCE_NON_JUSTIFIEE", label: "Absence non justifiée" },
];

export const SPECIAL_LEAVE_TYPES: LeaveTypeDef[] = [
  { value: "SPECIAL_MARIAGE", label: "Mariage du salarié", droit: 4, joursNonDeduits: 2 },
  { value: "SPECIAL_MARIAGE_ENFANT", label: "Mariage d'un enfant", droit: 2 },
  { value: "SPECIAL_NAISSANCE", label: "Naissance / adoption", droit: 3 },
  { value: "SPECIAL_DECES", label: "Décès d'un proche (conjoint, enfant, parent, frère/sœur)", droit: 3 },
  { value: "SPECIAL_CIRCONCISION", label: "Circoncision d'un enfant", droit: 2 },
];

export const ALL_LEAVE_TYPES: LeaveTypeDef[] = [
  ...STANDARD_LEAVE_TYPES,
  ...ABSENCE_LEAVE_TYPES,
  ...SPECIAL_LEAVE_TYPES,
];

/** A justificatif is expected for this type (it may be filed after the request). */
export function needsJustificatif(type: string): boolean {
  return ABSENCE_LEAVE_TYPES.some((t) => t.value === type && t.needsJustificatif);
}

export const LEAVE_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  ALL_LEAVE_TYPES.map((t) => [t.value, t.label]),
);

export function isSpecialLeave(type: string): boolean {
  return SPECIAL_LEAVE_TYPES.some((t) => t.value === type);
}

export function isValidLeaveType(type: string): boolean {
  return ALL_LEAVE_TYPES.some((t) => t.value === type);
}

/** Maximum jours for one event of this congé spécial. */
export function specialLeaveEntitlement(type: string): number | undefined {
  return SPECIAL_LEAVE_TYPES.find((t) => t.value === type)?.droit;
}

/** Free jours of a congé spécial (the rest is taken from CP), if it has a split. */
export function specialLeaveFreeDays(type: string): number | undefined {
  return SPECIAL_LEAVE_TYPES.find((t) => t.value === type)?.joursNonDeduits;
}

/**
 * Jours of this request to take from the CP solde.
 *  - CP: every jour.
 *  - A congé spécial with a free allowance (mariage du salarié: 2 free, the
 *    rest from CP): whatever exceeds the free jours not already used by the
 *    other live requests of the same event (`alreadyUsed`).
 *  - Everything else: none.
 */
export function cpDaysToDeduct(type: string, days: number, alreadyUsed = 0): number {
  if (type === "CP") return days;
  const free = specialLeaveFreeDays(type);
  if (free === undefined) return 0;
  const freeLeft = Math.max(0, free - alreadyUsed);
  return Math.max(0, days - freeLeft);
}

/**
 * Days a request covers — Monday–Saturday for congés spéciaux, Monday–Friday
 * otherwise. `daysOff` (the Aïds) are never counted, whatever the type.
 */
export function countLeaveDays(type: string, start: Date, end: Date, daysOff?: ReadonlySet<string>): number {
  return isSpecialLeave(type)
    ? workingDaysMonSatBetween(start, end, daysOff)
    : businessDaysBetween(start, end, daysOff);
}
