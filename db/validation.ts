import type {
  MedicationInput,
  MedicationScheduleInput,
  PushSubscriptionInput,
  RelativeInput,
  UpdateMedicationInput,
  UpdateMedicationScheduleInput,
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
    photoUrl: validatePhotoUrl(input.photoUrl),
    position: position(input.position),
  };
}

/** Client-side resizing keeps real photos well under this; a hard cap here is just abuse protection. */
const MAX_PHOTO_DATA_URL_LENGTH = 350_000;

export function validatePhotoUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (
    typeof value !== "string"
    || value.length > MAX_PHOTO_DATA_URL_LENGTH
    || !/^data:image\/(jpeg|png|webp);base64,/.test(value)
  ) {
    throw new FamilyCareDataError("INVALID_INPUT");
  }
  return value;
}

export function validateExpectedVersion(value: number): number {
  return version(value);
}

export function validateEmail(value: string): string {
  const normalized = requireText(value, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new FamilyCareDataError("INVALID_INPUT");
  }
  return normalized;
}

const ALL_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

function daysOfWeek(values: number[] | undefined): number[] {
  const normalized = values === undefined ? ALL_WEEKDAYS : values;
  const unique = [...new Set(normalized)];
  if (
    unique.length === 0
    || unique.length > 7
    || unique.some((day) => !Number.isSafeInteger(day) || day < 1 || day > 7)
  ) {
    throw new FamilyCareDataError("INVALID_INPUT");
  }
  return unique.sort((a, b) => a - b);
}

export function validateScheduleInput(
  input: MedicationScheduleInput | UpdateMedicationScheduleInput,
) {
  const timeOfDay = requireText(input.timeOfDay, 5);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(timeOfDay)) {
    throw new FamilyCareDataError("INVALID_INPUT");
  }

  const quantity = input.quantity ?? 1;
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100) {
    throw new FamilyCareDataError("INVALID_INPUT");
  }

  return {
    timeOfDay,
    daysOfWeek: daysOfWeek(input.daysOfWeek),
    quantity,
    position: position(input.position),
  };
}

export function validateOccurrenceDate(value: string): string {
  const normalized = requireText(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new FamilyCareDataError("INVALID_INPUT");
  }
  return normalized;
}

export function validatePushSubscriptionInput(input: PushSubscriptionInput) {
  const endpoint = requireText(input.endpoint, 600);
  if (!/^https:\/\//.test(endpoint)) {
    throw new FamilyCareDataError("INVALID_INPUT");
  }
  return {
    endpoint,
    p256dh: requireText(input.p256dh, 200),
    authKey: requireText(input.authKey, 200),
    userAgent: input.userAgent
      ? optionalText(input.userAgent, 300)
      : null,
  };
}
