import type { FamilyRole } from "./schema.ts";

export type AuthenticatedUserContext = {
  userId: string;
  requestId?: string;
};

export type AuthorizedFamilyContext = AuthenticatedUserContext & {
  familyId: string;
};

export type CreateFamilyInput = {
  name: string;
};

export type AddFamilyMemberInput = {
  userId: string;
  role: Exclude<FamilyRole, "admin">;
};

export type MedicationInput = {
  name: string;
  dosage: string;
  orientation?: string;
  frequency?: number;
  schedules?: string[];
  legacySchedule?: string;
  position?: number;
};

export type RelativeInput = {
  name: string;
  relation: string;
  birthDate: string;
  bloodType: string;
  conditions?: string[];
  allergies?: string[];
  notes?: string;
  color?: string;
  /** A `data:image/...;base64,...` URI, or null/omitted for no photo. See `validatePhotoUrl`. */
  photoUrl?: string | null;
  position?: number;
  medications?: MedicationInput[];
};

export type UpdateRelativeInput = Omit<RelativeInput, "medications"> & {
  expectedVersion: number;
};

export type UpdateMedicationInput = MedicationInput & {
  expectedVersion: number;
};

export type CreateInvitationInput = {
  emailNormalized: string;
  role: Exclude<FamilyRole, "admin">;
};

export type MedicationScheduleInput = {
  /** "HH:MM", 24h clock. */
  timeOfDay: string;
  /** ISO weekday numbers, 1=segunda..7=domingo. Defaults to every day. */
  daysOfWeek?: number[];
  quantity?: number;
  position?: number;
};

export type UpdateMedicationScheduleInput = MedicationScheduleInput & {
  expectedVersion: number;
};

export type LogDoseInput = {
  /** "YYYY-MM-DD", the local calendar day this occurrence belongs to. */
  occurrenceDate: string;
  takenAt?: number;
  notes?: string;
};

export type PushSubscriptionInput = {
  endpoint: string;
  p256dh: string;
  authKey: string;
  userAgent?: string;
};
