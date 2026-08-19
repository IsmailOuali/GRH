/**
 * Maps a linked EmployeeDossier onto document-template field values so a
 * document form can be pre-filled "in one click" from an employee's dossier.
 *
 * Only non-sensitive-to-map, template-relevant fields are surfaced. The
 * employee NAME is deliberately NOT mapped here — it always comes from the
 * selected user account (never a name match), to stay correct when two
 * employees share the same nom/prénom.
 */

/** The subset of dossier columns this mapper reads. */
export interface DossierPrefillSource {
  numeroCin: string | null;
  numeroCnss: string | null;
  poste: string | null;
  dateIntegration: string | null;
  typeContrat: string | null;
}

/** Keep only strict `yyyy-mm-dd` dates so <input type="date"> can bind them. */
function isoDateOrEmpty(v: string | null): string {
  if (v && /^\d{4}-\d{2}-\d{2}$/.test(v.trim())) return v.trim();
  return "";
}

export function dossierToDocumentFields(d: DossierPrefillSource): Record<string, string> {
  const out: Record<string, string> = {};
  const set = (key: string, value: string | null | undefined) => {
    if (value && value.trim()) out[key] = value.trim();
  };

  set("numero_cin", d.numeroCin);
  set("numero_cnss", d.numeroCnss);
  set("intitule_poste", d.poste);
  set("date_integration", isoDateOrEmpty(d.dateIntegration));
  // Document templates only offer CDI / CDD; skip STAGE / AUTRE so the select
  // doesn't land on an option that isn't there.
  if (d.typeContrat === "CDI" || d.typeContrat === "CDD") set("type_contrat", d.typeContrat);

  return out;
}
