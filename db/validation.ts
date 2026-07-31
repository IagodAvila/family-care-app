import type {
  MedicationInput,
  RelativeInput,
  UpdateMedicationInput,
  UpdateRelativeInput,
} from "./domain.ts";
import { FamilyCareDataError } from "./errors.ts";
import { familyRoles, type FamilyRole } from "./schema.ts";

function requireText(value: string, maximumLength: number): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > maximumLength) {
    throw new FamilyCareDataError("INVALID_INPUT");
  }
  return normalized;
}

function optionalText(value: string | undefined, maximumLength: number): string {
  const normalized = value?.trim() ?? "";
  if (normalized.length > maximumLength) {
    throw new FamilyCareDataError("INVALID_INPUT");
  }
  return normalized;
}

function textList(values: string[] | undefined): string[] {
  const normalized = (values ?? []).map((value) => requireText(value, 120));
  if (normalized.length > 50) {
    throw new FamilyCareDataError("INVALID_INPUT");
  }
  return normalized;
}

function position(value: number | undefined): number {
  const normalized = value ?? 0;
  if (!Number.isSafeInteger(normalized) || normalized < 0) {
    throw new FamilyCareDataError("INVALID_INPUT");
  }
  return normalized;
}

function version(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new FamilyCareDataError("INVALID_INPUT");
  }
  return value;
}

export function validateFamilyName(name: string): string {
  return requireText(name, 120);
}

export function validateRole(role: string): FamilyRole {
  if (!familyRoles.includes(role as FamilyRole)) {
    throw new FamilyCareDataError("INVALID_INPUT");
  }
  return role as FamilyRole;
}

export function validateMedicationInput(
  input: MedicationInput | UpdateMedicationInput,
) {
  const frequency =
    input.frequency === undefined ? null : input.frequency;
  if (
    frequency !== null
    && (!Number.isSafeInteger(frequency) || frequency < 1 || frequency > 24)
  ) {
    throw new FamilyCareDataError("INVALID_INPUT");
  }

  const schedules = textList(input.schedules);
  if (schedules.length > 24) {
    throw new FamilyCareDataError("INVALID_INPUT");
  }

  return {
    name: requireText(input.name, 160),
    dosage: optionalText(input.dosage, 160),
    orientation: optionalText(input.orientation, 500),
    frequency,
    schedules,
    legacySchedule: input.legacySchedule
      ? optionalText(input.legacySchedule, 160)
      : null,
    position: position(input.position),
  };
}

export function validateRelativeInput(
  input: RelativeInput | UpdateRelativeInput,
) {
  const birthDate = requireText(input.birthDate, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    throw new FamilyCareDataError("INVALID_INPUT");
  }
  const [year, month, day] = birthDate.split("-").map(Number);
  const normalizedDate = new Date(Date.UTC(year, month - 1, day));
  if (
    normalizedDate.getUTCFullYear() !== year
    || normalizedDate.getUTCMonth() !== month - 1
    || normalizedDate.getUTCDate() !== day
    || normalizedDate.getTime() > Date.now()
  ) {
    throw new FamilyCareDataError("INVALID_INPUT");
  }

  return {
    name: requireText(input.name, 160),
    relation: requireText(input.relation, 80),
    birthDate,
    bloodType: requireText(input.bloodType, 8),
    conditions: textList(input.conditions),
    allergies: textList(input.allergies),
    notes: optionalText(input.notes, 2_000),
    color: optionalText(input.color, 32),
    position: position(input.position),
  };
}

export function validateExpectedVersion(value: number): number {
  return version(value);
}
