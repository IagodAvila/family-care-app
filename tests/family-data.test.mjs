import assert from "node:assert/strict";
import test from "node:test";

import { createRelative, deleteRelative, updateRelative } from "../app/family-data.mjs";

function formData(values) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const originalRelative = {
  id: "relative-1",
  name: "Ana Souza",
  relation: "Mãe",
  birthDate: "1970-05-10",
  bloodType: "O+",
  conditions: [],
  allergies: [],
  medications: [],
  notes: "",
  color: "#277f7b",
};

test("cadastra um familiar com dados de saúde e medicamento opcional", () => {
  const relative = createRelative(formData({
    name: "João Souza",
    relation: "Pai",
    birthDate: "1968-02-20",
    bloodType: "A+",
    conditions: "Hipertensão, Diabetes",
    allergies: "Dipirona",
    medication: "Losartana",
    dosage: "50 mg",
    schedule: "Pela manhã",
    notes: "Acompanhamento anual",
  }), 0, "relative-2");

  assert.deepEqual(relative, {
    id: "relative-2",
    name: "João Souza",
    relation: "Pai",
    birthDate: "1968-02-20",
    bloodType: "A+",
    conditions: ["Hipertensão", "Diabetes"],
    allergies: ["Dipirona"],
    medications: [{ name: "Losartana", dosage: "50 mg", schedule: "Pela manhã" }],
    notes: "Acompanhamento anual",
    color: "#277f7b",
  });
});

test("edita os dados do familiar sem perder medicamentos e identidade", () => {
  const family = [{ ...originalRelative, medications: [{ name: "Vitamina D", dosage: "1 dose", schedule: "Semanal" }] }];
  const updated = updateRelative(family, originalRelative.id, formData({
    name: "Ana Lima",
    relation: "Avó",
    birthDate: "1970-05-10",
    bloodType: "A-",
    conditions: "Asma",
    allergies: "",
    notes: "Cadastro revisado",
  }));

  assert.equal(updated[0].id, originalRelative.id);
  assert.equal(updated[0].name, "Ana Lima");
  assert.equal(updated[0].relation, "Avó");
  assert.deepEqual(updated[0].conditions, ["Asma"]);
  assert.deepEqual(updated[0].medications, family[0].medications);
  assert.notStrictEqual(updated, family);
});

test("exclui somente o familiar selecionado", () => {
  const secondRelative = { ...originalRelative, id: "relative-2", name: "Carlos Souza" };
  const family = [originalRelative, secondRelative];

  const remaining = deleteRelative(family, originalRelative.id);

  assert.deepEqual(remaining, [secondRelative]);
  assert.equal(family.length, 2);
});
