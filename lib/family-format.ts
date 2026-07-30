import type { Medication } from "@/types/family";
import { normalizeMedication } from "./family-data.mjs";

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
  const normalized = normalizeMedication(medication) as Medication;
  return normalized.orientation || "Orientação de uso não informada";
}
