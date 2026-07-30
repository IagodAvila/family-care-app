import assert from "node:assert/strict";
import test from "node:test";

import { addMedicationToList, applyDateMask, createMedication, createRelative, deleteRelative, displayDateToInternal, internalDateToDisplay, removeLegacyStarterFamily, removeMedicationFromList, restoreFamily, updateMedicationInList, updateRelative, validateBirthDate } from "../lib/family-data.ts";

function formData(values) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const originalRelative = { id: "relative-1", name: "Ana Souza", relation: "Mãe", birthDate: "1970-05-10", bloodType: "O+", conditions: [], allergies: [], medications: [], notes: "", color: "#277f7b" };

test("aplica máscara DD/MM/AAAA e converte entre exibição e armazenamento", () => {
  assert.equal(applyDateMask("12021990"), "12/02/1990");
  assert.equal(applyDateMask("12a02/199055"), "12/02/1990");
  assert.equal(displayDateToInternal("12/02/1990"), "1990-02-12");
  assert.equal(internalDateToDisplay("1990-02-12"), "12/02/1990");
});

test("valida nascimento completo, existente e não futuro", () => {
  const today = new Date(2026, 6, 27);
  assert.deepEqual(validateBirthDate("29/02/2024", today), { internalDate: "2024-02-29" });
  assert.match(validateBirthDate("29/02/202", today).error, /completa/i);
  assert.match(validateBirthDate("31/02/2020", today).error, /válida/i);
  assert.match(validateBirthDate("28/07/2026", today).error, /futuro/i);
});

test("mantém compatibilidade com data ISO e medicamentos antigos", () => {
  assert.equal(internalDateToDisplay("1970-05-10"), "10/05/1970");
  const relative = createRelative(formData({ name: "Ana", relation: "Mãe", birthDate: "1970-05-10", bloodType: "O+", conditions: "", allergies: "", notes: "" }), 0, "ana", [{ name: "Vitamina D", dosage: "1 dose", schedule: "Semanal" }]);
  assert.deepEqual(relative.medications, [{ name: "Vitamina D", dosage: "1 dose", schedule: "Semanal", orientation: "Semanal" }]);
});

test("restaura o formato antigo persistido sem descartar horários legados", () => {
  const restored = restoreFamily([{
    ...originalRelative,
    id: "antonio",
  }, {
    id: originalRelative.id,
    name: originalRelative.name,
    relation: originalRelative.relation,
    birthDate: originalRelative.birthDate,
    bloodType: originalRelative.bloodType,
    medications: [{
      name: "Vitamina D",
      dosage: "1 dose",
      frequency: 1,
      schedules: ["08:00", "20:00"],
      schedule: "Semanal",
    }],
  }]);

  assert.equal(restored.length, 1);
  assert.deepEqual(restored[0].conditions, []);
  assert.deepEqual(restored[0].allergies, []);
  assert.equal(restored[0].notes, "");
  assert.equal(restored[0].color, "#277f7b");
  assert.deepEqual(restored[0].medications, [{
    name: "Vitamina D",
    dosage: "1 dose",
    orientation: "08:00 e 20:00",
    frequency: 1,
    schedules: ["08:00", "20:00"],
    schedule: "Semanal",
  }]);
});

test("salva vários medicamentos iniciais e ignora objetos sem nome", () => {
  const medications = [
    { name: "Losartana", dosage: "50 mg", orientation: "1 comprimido pela manhã" },
    { name: "Dipirona", dosage: "", orientation: "Usar somente em caso de dor" },
    { name: "", dosage: "10 mg", orientation: "" },
  ];
  const relative = createRelative(formData({ name: "João", relation: "Pai", birthDate: "1968-02-20", bloodType: "A+", conditions: "", allergies: "", notes: "" }), 0, "joao", medications);
  assert.deepEqual(relative.medications, medications.slice(0, 2));
});

test("cria medicamento com texto livre sem completar informações médicas", () => {
  const medication = createMedication(formData({ name: "Amoxicilina", dosage: "", orientation: "Tomar a cada 8 horas por 7 dias" }));
  assert.deepEqual(medication, { name: "Amoxicilina", dosage: "", orientation: "Tomar a cada 8 horas por 7 dias" });
});

test("adiciona, edita e remove medicamentos temporários sem apagar os demais", () => {
  const first = { name: "Losartana", dosage: "50 mg", orientation: "Pela manhã" };
  const second = { name: "Dipirona", dosage: "1 g", orientation: "Em caso de dor" };
  const withBoth = addMedicationToList(addMedicationToList([], first), second);
  assert.equal(addMedicationToList(withBoth, { name: "", dosage: "", orientation: "" }).length, 2);
  const edited = updateMedicationInList(withBoth, 0, { ...first, orientation: "Após o café" });
  assert.deepEqual(edited[1], second);
  assert.deepEqual(removeMedicationFromList(edited, 0), [second]);
});

test("edita familiar sem perder medicamentos, identidade ou dados temporários já salvos", () => {
  const family = [{ ...originalRelative, medications: [{ name: "Vitamina D", dosage: "1 dose", orientation: "Semanal" }] }];
  const updated = updateRelative(family, originalRelative.id, formData({ name: "Ana Lima", relation: "Avó", birthDate: "1970-05-10", bloodType: "A-", conditions: "Asma", allergies: "", notes: "Cadastro revisado" }));
  assert.equal(updated[0].id, originalRelative.id);
  assert.deepEqual(updated[0].medications, family[0].medications);
  assert.equal(updated[0].name, "Ana Lima");
});

test("exclui somente o familiar selecionado e remove dados fictícios antigos", () => {
  const secondRelative = { ...originalRelative, id: "relative-2" };
  assert.deepEqual(deleteRelative([originalRelative, secondRelative], originalRelative.id), [secondRelative]);
  assert.deepEqual(removeLegacyStarterFamily([{ ...originalRelative, id: "antonio" }, originalRelative]), [originalRelative]);
});
