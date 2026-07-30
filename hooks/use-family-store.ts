"use client";

import { useEffect, useState } from "react";
import {
  createMedication,
  createRelative,
  deleteRelative,
  restoreFamily,
  updateRelative,
} from "@/lib/family-data";
import type { Medication, Relative } from "@/types/family";

const STORAGE_KEY = "familycare-family";

export function useFamilyStore() {
  const [family, setFamily] = useState<Relative[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [hydrated, setHydrated] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect -- Hydrates React state from browser storage once. */
  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);

    if (saved) {
      try {
        const parsed: unknown = JSON.parse(saved);
        const savedFamily = restoreFamily(parsed);

        setFamily(savedFamily);
        setSelectedId(savedFamily[0]?.id ?? "");
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }

    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (hydrated) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(family));
    }
  }, [family, hydrated]);

  const selected = family.find((person) => person.id === selectedId) ?? family[0];

  function saveRelative(editingId: string | null, data: FormData, medications: Medication[]) {
    if (editingId) {
      setFamily((current) => updateRelative(current, editingId, data));
      return;
    }

    const person = createRelative(
      data,
      family.length,
      crypto.randomUUID(),
      medications,
    );

    setFamily((current) => [...current, person]);
    setSelectedId(person.id);
  }

  function removeSelectedRelative() {
    if (!selected) return false;

    const firstConfirmation = window.confirm(
      `Tem certeza de que deseja apagar ${selected.name}?`,
    );
    if (!firstConfirmation) return false;

    const finalConfirmation = window.confirm(
      `Confirmação final: todos os dados de ${selected.name}, incluindo medicamentos, serão excluídos definitivamente. Deseja continuar?`,
    );
    if (!finalConfirmation) return false;

    const remainingFamily = deleteRelative(family, selected.id);
    setFamily(remainingFamily);
    setSelectedId(remainingFamily[0]?.id ?? "");
    return remainingFamily.length === 0;
  }

  function addMedication(data: FormData) {
    if (!selected) return false;

    const medication = createMedication(data);
    if (!medication.name) return false;

    setFamily((current) =>
      current.map((person) =>
        person.id === selected.id
          ? { ...person, medications: [...person.medications, medication] }
          : person,
      ),
    );
    return true;
  }

  function removeMedication(index: number) {
    if (!selected) return;

    const medication = selected.medications[index];
    if (!window.confirm(`Remover ${medication.name} dos medicamentos de ${selected.name}?`)) {
      return;
    }

    setFamily((current) =>
      current.map((person) =>
        person.id === selected.id
          ? {
              ...person,
              medications: person.medications.filter(
                (_, medicationIndex) => medicationIndex !== index,
              ),
            }
          : person,
      ),
    );
  }

  return {
    family,
    selected,
    selectedId,
    selectRelative: setSelectedId,
    saveRelative,
    removeSelectedRelative,
    addMedication,
    removeMedication,
  };
}
