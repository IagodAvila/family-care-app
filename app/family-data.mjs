export const familyColors = ["#277f7b", "#8a6fbc", "#d7855e", "#3b6aa0", "#a26371"];
const legacyStarterIds = new Set(["antonio", "lucia", "marina"]);

export function removeLegacyStarterFamily(family) {
  return family.filter((person) => !legacyStarterIds.has(person.id));
}

export function parseList(value) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function createMedication(data, nameField = "name") {
  const schedules = data.getAll("schedules").map(String).filter(Boolean);
  const legacySchedule = String(data.get("schedule") ?? "").trim();

  return {
    name: String(data.get(nameField) ?? "").trim(),
    dosage: String(data.get("dosage") || "Não informada"),
    frequency: Number(data.get("frequency") || schedules.length || 1),
    schedules: schedules.length ? schedules : legacySchedule ? [legacySchedule] : [],
  };
}

export function createRelative(data, familySize, id = crypto.randomUUID()) {
  const medicationName = String(data.get("medication") ?? "").trim();

  return {
    id,
    name: String(data.get("name") ?? ""),
    relation: String(data.get("relation") ?? ""),
    birthDate: String(data.get("birthDate") ?? ""),
    bloodType: String(data.get("bloodType") ?? ""),
    conditions: parseList(data.get("conditions")),
    allergies: parseList(data.get("allergies")),
    medications: medicationName ? [createMedication(data, "medication")] : [],
    notes: String(data.get("notes") ?? ""),
    color: familyColors[familySize % familyColors.length],
  };
}

export function updateRelative(family, relativeId, data) {
  return family.map((person) => person.id === relativeId ? {
    ...person,
    name: String(data.get("name") ?? ""),
    relation: String(data.get("relation") ?? ""),
    birthDate: String(data.get("birthDate") ?? ""),
    bloodType: String(data.get("bloodType") ?? ""),
    conditions: parseList(data.get("conditions")),
    allergies: parseList(data.get("allergies")),
    notes: String(data.get("notes") ?? ""),
  } : person);
}

export function deleteRelative(family, relativeId) {
  return family.filter((person) => person.id !== relativeId);
}
