export type Medication = {
  /** Absent for a medication not yet persisted to the server. */
  id?: string;
  /** Absent for a medication not yet persisted; required to update/delete it (optimistic concurrency). */
  version?: number;
  name: string;
  dosage: string;
  orientation?: string;
  frequency?: number;
  schedules?: string[];
  schedule?: string;
};

export type Relative = {
  id: string;
  /** Absent for a relative not yet persisted; required to update/delete it (optimistic concurrency). */
  version?: number;
  name: string;
  relation: string;
  birthDate: string;
  bloodType: string;
  conditions: string[];
  allergies: string[];
  medications: Medication[];
  notes: string;
  color: string;
  /** A `data:image/...;base64,...` URI, or null/absent for no photo (falls back to initials). */
  photoUrl?: string | null;
};
