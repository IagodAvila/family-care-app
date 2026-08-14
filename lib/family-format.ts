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

/** "08:00" -> "08:00" (already display-ready; validates/normalizes stray input). */
export function formatTime(timeOfDay: string) {
  const match = String(timeOfDay ?? "").match(/^(\d{2}):(\d{2})$/);
  return match ? `${match[1]}:${match[2]}` : timeOfDay;
}

/** ISO weekday (1=segunda..7=domingo) -> short pt-BR label, for the day-of-week toggle chips. */
export const WEEKDAY_LABELS: Record<number, string> = {
  1: "Seg",
  2: "Ter",
  3: "Qua",
  4: "Qui",
  5: "Sex",
  6: "Sáb",
  7: "Dom",
};

/** A day bucketed into four stretches, for grouping the "Hoje" dose list so it doesn't grow huge with many medications. */
export type DayPeriod = "madrugada" | "manha" | "tarde" | "noite";

/** Chronological order (not alphabetical/object-key order) for rendering period groups. */
export const DAY_PERIODS: DayPeriod[] = ["manha", "tarde", "noite", "madrugada"];

export const DAY_PERIOD_LABELS: Record<DayPeriod, string> = {
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
  madrugada: "Madrugada",
};

/** hour (0-23, local clock) -> which stretch of the day it falls in. 6h-12h manhã, 12h-18h tarde, 18h-24h noite, 0h-6h madrugada. */
export function getDayPeriod(hour: number): DayPeriod {
  if (hour >= 6 && hour < 12) return "manha";
  if (hour >= 12 && hour < 18) return "tarde";
  if (hour >= 18) return "noite";
  return "madrugada";
}

/** "08:00" -> the hour as a number, for bucketing a schedule's `timeOfDay` into a `DayPeriod`. */
export function hourFromTime(timeOfDay: string): number {
  return Number(String(timeOfDay ?? "").slice(0, 2)) || 0;
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
