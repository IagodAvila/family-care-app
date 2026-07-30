export type Medication = {
  name: string;
  dosage: string;
  orientation?: string;
  frequency?: number;
  schedules?: string[];
  schedule?: string;
};

export type Relative = {
  id: string;
  name: string;
  relation: string;
  birthDate: string;
  bloodType: string;
  conditions: string[];
  allergies: string[];
  medications: Medication[];
  notes: string;
  color: string;
};
