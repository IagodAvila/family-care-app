import type { Medication, Relative } from "@/types/family";

export const familyColors = ["#277f7b", "#8a6fbc", "#d7855e", "#3b6aa0", "#a26371"];
const legacyStarterIds = new Set(["antonio", "lucia", "marina"]);

type BirthDateValidation =
  | { error: string; internalDate?: never }
  | { error?: never; internalDate: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function normalizeStoredRelative(value: unknown, familyIndex: number): Relative {
  if (
    !isRecord(value)
    || typeof value.id !== "string"
    || typeof value.name !== "string"
    || typeof value.relation !== "string"
    || typeof value.birthDate !== "string"
    || typeof value.bloodType !== "string"
  ) {
    throw new TypeError("Dados de familiar inválidos.");
  }

  const conditions = isStringArray(value.conditions) ? value.conditions : [];
  const allergies = isStringArray(value.allergies) ? value.allergies : [];
  const storedMedications = Array.isArray(value.medications) ? value.medications : [];

  return {
    id: value.id,
    name: value.name,
    relation: value.relation,
    birthDate: value.birthDate,
    bloodType: value.bloodType,
    conditions,
    allergies,
    medications: storedMedications
      .map(normalizeMedication)
      .filter((medication) => medication.name),
    notes: typeof value.notes === "string" ? value.notes : "",
    color: typeof value.color === "string"
      ? value.color
      : familyColors[familyIndex % familyColors.length],
    photoUrl: typeof value.photoUrl === "string" ? value.photoUrl : null,
  };
}

export function restoreFamily(value: unknown): Relative[] {
  if (!Array.isArray(value)) {
    throw new TypeError("Dados da família inválidos.");
  }

  const withoutLegacyStarterFamily = value.filter(
    (person) => !isRecord(person)
      || typeof person.id !== "string"
      || !legacyStarterIds.has(person.id),
  );

  return withoutLegacyStarterFamily.map(normalizeStoredRelative);
}

export function removeLegacyStarterFamily(family: readonly Relative[]): Relative[] {
  return family.filter((person) => !legacyStarterIds.has(person.id));
}

export function parseList(value: FormDataEntryValue | null | undefined): string[] {
  return String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

/** Keeps only eight digits and adds separators while the user types. */
export function applyDateMask(value: string): string {
  const digits = String(value ?? "").replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function internalDateToDisplay(value: string): string {
  const match = String(value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : applyDateMask(value);
}

export function displayDateToInternal(value: string): string {
  const match = String(value ?? "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
}

export function validateBirthDate(
  value: string,
  today = new Date(),
): BirthDateValidation {
  const internalDate = displayDateToInternal(value);
  if (!internalDate) return { error: "Informe a data de nascimento completa no formato DD/MM/AAAA." };
  const [year, month, day] = internalDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return { error: "Informe uma data de nascimento válida." };
  }
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (date > startOfToday) return { error: "A data de nascimento não pode estar no futuro." };
  return { internalDate };
}

export function normalizeMedication(value: unknown): Medication {
  const medication = isRecord(value) ? value : {};
  const schedules = Array.isArray(medication.schedules)
    ? medication.schedules.map(String).filter(Boolean)
    : [];
  const legacySchedule = String(medication.schedule ?? "").trim();
  const legacyOrientation = schedules.length ? schedules.join(" e ") : legacySchedule;
  const normalized = {
    name: String(medication.name ?? "").trim(),
    dosage: String(medication.dosage ?? "").trim(),
    orientation: String(medication.orientation ?? legacyOrientation).trim(),
  } satisfies Medication;

  const compatibleMedication: Medication = {
    ...normalized,
  };

  // Carried through (not re-derived) so editing an already-persisted
  // medication in place keeps its server identity instead of looking like
  // a brand new one — see lib/family-data.ts's `toMedicationInput` callers.
  if (typeof medication.id === "string") compatibleMedication.id = medication.id;
  if (typeof medication.version === "number") compatibleMedication.version = medication.version;

  if (schedules.length) compatibleMedication.schedules = schedules;
  if (legacySchedule) compatibleMedication.schedule = legacySchedule;
  if (typeof medication.frequency === "number" && Number.isFinite(medication.frequency)) {
    compatibleMedication.frequency = medication.frequency;
  }

  return compatibleMedication;
}

/** Client `Medication` → the shape `FamilyCareDataService`'s create/update methods expect. */
export function toMedicationInput(medication: Medication) {
  return {
    name: medication.name,
    dosage: medication.dosage,
    orientation: medication.orientation,
    frequency: medication.frequency,
    schedules: medication.schedules,
    legacySchedule: medication.schedule,
  };
}

/** Client relative fields → the shape `FamilyCareDataService.createRelative` expects. */
export function toRelativeInput(relative: {
  name: string;
  relation: string;
  birthDate: string;
  bloodType: string;
  conditions: string[];
  allergies: string[];
  notes: string;
  color?: string;
  photoUrl?: string | null;
  medications?: readonly Medication[];
}) {
  return {
    name: relative.name,
    relation: relative.relation,
    birthDate: relative.birthDate,
    bloodType: relative.bloodType,
    conditions: relative.conditions,
    allergies: relative.allergies,
    notes: relative.notes,
    color: relative.color,
    photoUrl: relative.photoUrl,
    medications: relative.medications
      ?.map(normalizeMedication)
      .filter((medication) => medication.name)
      .map(toMedicationInput),
  };
}

export function createMedication(data: FormData, nameField = "name"): Medication {
  return normalizeMedication({
    name: data.get(nameField),
    dosage: data.get("dosage"),
    orientation: data.get("orientation"),
    schedules: data.getAll("schedules"),
    schedule: data.get("schedule"),
  });
}

export function addMedicationToList(
  medications: Medication[],
  medication: Medication,
): Medication[] {
  const normalized = normalizeMedication(medication);
  return normalized.name ? [...medications, normalized] : medications;
}

export function updateMedicationInList(
  medications: Medication[],
  index: number,
  medication: Medication,
): Medication[] {
  const normalized = normalizeMedication(medication);
  return normalized.name ? medications.map((item, itemIndex) => itemIndex === index ? normalized : item) : medications;
}

export function removeMedicationFromList(
  medications: Medication[],
  index: number,
): Medication[] {
  return medications.filter((_, itemIndex) => itemIndex !== index);
}

export function createRelative(
  data: FormData,
  familySize: number,
  id = crypto.randomUUID(),
  medications: readonly Medication[] = [],
): Relative {
  const legacyMedicationName = String(data.get("medication") ?? "").trim();
  const allMedications = medications.length ? medications : legacyMedicationName ? [createMedication(data, "medication")] : [];
  return {
    id,
    name: String(data.get("name") ?? ""),
    relation: String(data.get("relation") ?? ""),
    birthDate: String(data.get("birthDate") ?? ""),
    bloodType: String(data.get("bloodType") ?? ""),
    conditions: parseList(data.get("conditions")),
    allergies: parseList(data.get("allergies")),
    medications: allMedications.map(normalizeMedication).filter((medication) => medication.name),
    notes: String(data.get("notes") ?? ""),
    color: familyColors[familySize % familyColors.length],
  };
}

export function updateRelative(
  family: readonly Relative[],
  relativeId: string,
  data: FormData,
  medications?: readonly Medication[],
): Relative[] {
  return family.map((person) => person.id === relativeId ? {
    ...person,
    name: String(data.get("name") ?? ""), relation: String(data.get("relation") ?? ""),
    birthDate: String(data.get("birthDate") ?? ""), bloodType: String(data.get("bloodType") ?? ""),
    conditions: parseList(data.get("conditions")), allergies: parseList(data.get("allergies")), notes: String(data.get("notes") ?? ""),
    // `medications` is only omitted by callers that don't manage the medication
    // list (kept for backward compatibility); when provided, it replaces the
    // person's medications, same normalization as a new relative.
    medications: medications
      ? medications.map(normalizeMedication).filter((medication) => medication.name)
      : person.medications,
  } : person);
}

export function deleteRelative(
  family: readonly Relative[],
  relativeId: string,
): Relative[] {
  return family.filter((person) => person.id !== relativeId);
}
