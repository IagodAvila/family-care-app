import type { Medication } from "@/types/family";
import { normalizeMedication } from "./family-data";

export function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function getAge(date: string) {
  const birth = new Date(`${date}T12:00:00`);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();

  if (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate())) {
    age--;
  }

  return age;
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(`${date}T12:00:00`));
}

export function getMedicationTiming(medication: Medication) {
  const normalized = normalizeMedication(medication);
  return normalized.orientation || "Orientação de uso não informada";
}

/** The standardized value for "no known conditions/allergies" — see the Descrever/Não possui toggle on those fields in RelativeForm. */
export const NO_DATA_LABEL = "Não possui";

/**
 * Older entries may have been saved as "Não tem" (or without the accent)
 * before the field was standardized on "Não possui". Recognized here so
 * they still render with the neutral chip color and, once the record is
 * re-saved, land back on the current wording via the form's toggle.
 */
const NO_DATA_SYNONYMS = new Set(["não possui", "nao possui", "não tem", "nao tem"]);

/** Whether a condition/allergy entry is that "none" marker rather than a real item — used to give it a neutral (not alarming) chip color. */
export function isNoDataValue(value: string) {
  return NO_DATA_SYNONYMS.has(value.trim().toLowerCase());
}
