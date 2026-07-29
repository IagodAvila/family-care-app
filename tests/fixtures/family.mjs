const medications = Array.from({ length: 6 }, (_, index) => ({
  name: `Medicamento fictício ${index + 1}`,
  dosage: `${index + 1}0 mg`,
  orientation: "Tomar conforme a orientação fictícia detalhada para validar textos longos sem criar overflow horizontal.",
}));

export const familyFixture = [
  { id: "fixture-1", name: "Ana Lima", relation: "Mãe", conditions: ["Hipertensão", "Diabetes"], allergies: ["Dipirona", "Látex"], medications },
  { id: "fixture-2", name: "Bruno", relation: "Pai", conditions: [], allergies: [], medications: [] },
  { id: "fixture-3", name: "Carla de Oliveira Nascimento Albuquerque", relation: "Irmã", conditions: ["Asma"], allergies: ["Amoxicilina"], medications: [medications[0]] },
  { id: "fixture-4", name: "Daniel Souza", relation: "Filho", conditions: [], allergies: [], medications: [] },
  { id: "fixture-5", name: "Elisa Maria da Conceição dos Santos Ferreira", relation: "Avó", conditions: ["Diabetes", "Hipertensão", "Arritmia"], allergies: ["Látex", "Aspirina"], medications: medications.slice(0, 2) },
  { id: "fixture-6", name: "Fábio", relation: "Tio", conditions: [], allergies: [], medications: [] },
  { id: "fixture-7", name: "Gabriela Martins", relation: "Prima", conditions: [], allergies: ["Aspirina"], medications: [medications[1]] },
  { id: "fixture-8", name: "Henrique Alexandre Pereira de Albuquerque Neto", relation: "Avô", conditions: ["Arritmia"], allergies: [], medications: medications.slice(0, 3) },
];
