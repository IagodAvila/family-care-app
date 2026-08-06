"use client";

import { useEffect, useRef, useState } from "react";
import {
  createMedication,
  createRelative,
  deleteRelative,
  restoreFamily,
  updateRelative,
} from "@/lib/family-data";
import type { Medication, Relative } from "@/types/family";

const STORAGE_KEY = "familycare-family";
/** How long the "changes saved" indicator stays visible. */
const SAVE_INDICATOR_DURATION_MS = 2000;

export function useFamilyStore() {
  const [family, setFamily] = useState<Relative[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const skipNextSaveIndicator = useRef(true);

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
    if (!hydrated) return;

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(family));

    // The first write after hydration just persists what was already on
    // disk (or an empty family); it is not a change the person made.
    if (skipNextSaveIndicator.current) {
      skipNextSaveIndicator.current = false;
      return;
    }

    setJustSaved(true);
    const timeout = window.setTimeout(
      () => setJustSaved(false),
      SAVE_INDICATOR_DURATION_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [family, hydrated]);

  const selected = family.find((person) => person.id === selectedId) ?? family[0];

  function saveRelative(editingId: string | null, data: FormData, medications: Medication[]) {
    if (editingId) {
      setFamily((current) => updateRelative(current, editingId, data, medications));
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

  /**
   * Deletes the selected relative. The caller is responsible for confirming
   * the action with the person first (see `ConfirmDialog`); this function
   * performs the deletion unconditionally. Returns whether the family
   * became empty, so the caller can turn off emergency mode if needed.
   */
  function deleteSelectedRelative() {
    if (!selected) return false;

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

  /** Removes a medication unconditionally; the caller confirms with the person first. */
  function deleteMedication(index: number) {
    if (!selected) return;

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
    justSaved,
    selected,
    selectedId,
    selectRelative: setSelectedId,
    saveRelative,
    deleteSelectedRelative,
    addMedication,
    deleteMedication,
  };
}
