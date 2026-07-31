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
  position?: number;
  medications?: MedicationInput[];
};

export type UpdateRelativeInput = Omit<RelativeInput, "medications"> & {
  expectedVersion: number;
};

export type UpdateMedicationInput = MedicationInput & {
  expectedVersion: number;
};
