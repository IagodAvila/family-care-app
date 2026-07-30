export const familyColors = ["#277f7b", "#8a6fbc", "#d7855e", "#3b6aa0", "#a26371"];
const legacyStarterIds = new Set(["antonio", "lucia", "marina"]);

export function removeLegacyStarterFamily(family) {
  return family.filter((person) => !legacyStarterIds.has(person.id));
}

export function parseList(value) {
  return String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

/** Keeps only eight digits and adds separators while the user types. */
export function applyDateMask(value) {
  const digits = String(value ?? "").replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function internalDateToDisplay(value) {
  const match = String(value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : applyDateMask(value);
}

export function displayDateToInternal(value) {
  const match = String(value ?? "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
}

export function validateBirthDate(value, today = new Date()) {
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

export function normalizeMedication(medication) {
  const schedules = Array.isArray(medication?.schedules) ? medication.schedules.map(String).filter(Boolean) : [];
  const legacySchedule = String(medication?.schedule ?? "").trim();
  const legacyOrientation = schedules.length ? schedules.join(" e ") : legacySchedule;
  const normalized = {
    name: String(medication?.name ?? "").trim(),
    dosage: String(medication?.dosage ?? "").trim(),
    orientation: String(medication?.orientation ?? legacyOrientation).trim(),
  };
  if (schedules.length) normalized.schedules = schedules;
  if (legacySchedule) normalized.schedule = legacySchedule;
  if (Number.isFinite(medication?.frequency)) normalized.frequency = medication.frequency;
  return normalized;
}

export function createMedication(data, nameField = "name") {
  return normalizeMedication({
    name: data.get(nameField),
    dosage: data.get("dosage"),
    orientation: data.get("orientation"),
    schedules: data.getAll("schedules"),
    schedule: data.get("schedule"),
  });
}

export function addMedicationToList(medications, medication) {
  const normalized = normalizeMedication(medication);
  return normalized.name ? [...medications, normalized] : medications;
}

export function updateMedicationInList(medications, index, medication) {
  const normalized = normalizeMedication(medication);
  return normalized.name ? medications.map((item, itemIndex) => itemIndex === index ? normalized : item) : medications;
}

export function removeMedicationFromList(medications, index) {
  return medications.filter((_, itemIndex) => itemIndex !== index);
}

export function createRelative(data, familySize, id = crypto.randomUUID(), medications = []) {
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

export function updateRelative(family, relativeId, data) {
  return family.map((person) => person.id === relativeId ? {
    ...person,
    name: String(data.get("name") ?? ""), relation: String(data.get("relation") ?? ""),
    birthDate: String(data.get("birthDate") ?? ""), bloodType: String(data.get("bloodType") ?? ""),
    conditions: parseList(data.get("conditions")), allergies: parseList(data.get("allergies")), notes: String(data.get("notes") ?? ""),
  } : person);
}

export function deleteRelative(family, relativeId) { return family.filter((person) => person.id !== relativeId); }
