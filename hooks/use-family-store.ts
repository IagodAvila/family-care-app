"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type ApiError } from "@/lib/api-client";
import {
  createMedication,
  familyColors,
  normalizeMedication,
  parseList,
  restoreFamily,
  toMedicationInput,
  toRelativeInput,
} from "@/lib/family-data";
import type { Medication, Relative } from "@/types/family";

/** Key the old client-only MVP used; only read here once, to offer a one-time import. */
const LEGACY_STORAGE_KEY = "familycare-family";
/** How long the "changes saved" indicator stays visible. */
const SAVE_INDICATOR_DURATION_MS = 2000;

export type AuthState = "loading" | "needs-login" | "ready";
export type CurrentUser = {
  id: string;
  displayName: string | null;
  emailNormalized: string;
  avatarUrl: string | null;
};

type ServerMedication = {
  id: string;
  version: number;
  name: string;
  dosage: string;
  orientation: string;
  frequency: number | null;
  schedules: string[];
  legacySchedule: string | null;
};

type ServerRelative = {
  id: string;
  version: number;
  name: string;
  relation: string;
  birthDate: string;
  bloodType: string;
  conditions: string[];
  allergies: string[];
  notes: string;
  color: string;
  photoUrl: string | null;
  medications: ServerMedication[];
};

function fromServerMedication(row: ServerMedication): Medication {
  return {
    id: row.id,
    version: row.version,
    name: row.name,
    dosage: row.dosage,
    orientation: row.orientation || undefined,
    frequency: row.frequency ?? undefined,
    schedules: row.schedules.length ? row.schedules : undefined,
    schedule: row.legacySchedule || undefined,
  };
}

function fromServerRelative(row: ServerRelative, index: number): Relative {
  return {
    id: row.id,
    version: row.version,
    name: row.name,
    relation: row.relation,
    birthDate: row.birthDate,
    bloodType: row.bloodType,
    conditions: row.conditions,
    allergies: row.allergies,
    notes: row.notes,
    color: row.color || familyColors[index % familyColors.length],
    photoUrl: row.photoUrl,
    medications: row.medications.map(fromServerMedication),
  };
}

/**
 * Replaces a relative's medications on the server to match `next`, given
 * what the server currently has (`previous`). `FamilyCareDataService`
 * manages medications one at a time (create/update/delete), unlike
 * `RelativeForm`'s all-at-once local editing — this reconciles the two:
 * entries with a server `id` are updated, entries without one are new, and
 * previous entries missing from `next` were removed in the form.
 */
async function syncMedications(
  familyId: string,
  relativeId: string,
  previous: readonly Medication[],
  next: readonly Medication[],
) {
  const previousById = new Map(previous.filter((m) => m.id).map((m) => [m.id as string, m]));
  const keptIds = new Set<string>();

  for (const medication of next) {
    if (medication.id && previousById.has(medication.id)) {
      keptIds.add(medication.id);
      const current = previousById.get(medication.id)!;
      await api(`/api/families/${familyId}/relatives/${relativeId}/medications/${medication.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...toMedicationInput(medication), expectedVersion: current.version }),
      });
    } else {
      await api(`/api/families/${familyId}/relatives/${relativeId}/medications`, {
        method: "POST",
        body: JSON.stringify(toMedicationInput(medication)),
      });
    }
  }

  for (const medication of previous) {
    if (medication.id && !keptIds.has(medication.id)) {
      await api(`/api/families/${familyId}/relatives/${relativeId}/medications/${medication.id}?expectedVersion=${medication.version}`, {
        method: "DELETE",
      });
    }
  }
}

export function useFamilyStore() {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [family, setFamily] = useState<Relative[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingLocalImport, setPendingLocalImport] = useState<Relative[] | null>(null);

  const showSaved = useCallback(() => {
    setJustSaved(true);
    const timeout = window.setTimeout(() => setJustSaved(false), SAVE_INDICATOR_DURATION_MS);
    return () => window.clearTimeout(timeout);
  }, []);

  const loadRelatives = useCallback(async (currentFamilyId: string) => {
    const data = await api(`/api/families/${currentFamilyId}/relatives`);
    const relatives: Relative[] = (data.relatives as ServerRelative[]).map(fromServerRelative);
    setFamily(relatives);
    setSelectedId((current) => (relatives.some((person) => person.id === current) ? current : relatives[0]?.id ?? ""));
    return relatives;
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const me = await api("/api/me");
        if (cancelled) return;
        setUser(me.user);

        let activeFamilyId: string | undefined = me.families?.[0]?.family?.id;
        if (!activeFamilyId) {
          const label = me.user.displayName ?? me.user.emailNormalized;
          const created = await api("/api/families", {
            method: "POST",
            body: JSON.stringify({ name: `Família de ${label}` }),
          });
          activeFamilyId = created.family.id;
        }
        if (cancelled || !activeFamilyId) return;
        setFamilyId(activeFamilyId);

        const relatives = await loadRelatives(activeFamilyId);
        if (cancelled) return;
        setAuthState("ready");

        if (relatives.length === 0) {
          const saved = window.localStorage.getItem(LEGACY_STORAGE_KEY);
          if (saved) {
            try {
              const parsed = restoreFamily(JSON.parse(saved));
              if (parsed.length) setPendingLocalImport(parsed);
            } catch {
              // Corrupted legacy data: nothing usable to offer for import.
            }
          }
        }
      } catch (caught) {
        if (cancelled) return;
        const status = (caught as ApiError).status;
        if (status !== 401) {
          setError(caught instanceof Error ? caught.message : "Não foi possível carregar seus dados.");
        }
        setAuthState("needs-login");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadRelatives]);

  const selected = family.find((person) => person.id === selectedId) ?? family[0];

  async function saveRelative(
    editingId: string | null,
    data: FormData,
    medications: Medication[],
  ): Promise<boolean> {
    if (!familyId) return false;

    try {
      const editingRelative = editingId ? family.find((person) => person.id === editingId) : undefined;
      const input = toRelativeInput({
        name: String(data.get("name") ?? ""),
        relation: String(data.get("relation") ?? ""),
        birthDate: String(data.get("birthDate") ?? ""),
        bloodType: String(data.get("bloodType") ?? ""),
        conditions: parseList(data.get("conditions")),
        allergies: parseList(data.get("allergies")),
        notes: String(data.get("notes") ?? ""),
        color: editingRelative?.color ?? familyColors[family.length % familyColors.length],
        photoUrl: String(data.get("photoUrl") ?? "") || null,
      });

      if (editingId && editingRelative) {
        await api(`/api/families/${familyId}/relatives/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify({ ...input, expectedVersion: editingRelative.version ?? 1 }),
        });
        // Medications aren't part of the relative PATCH (see syncMedications'
        // docstring) — apply their diff, then refetch so the local copy
        // picks up every server-assigned id/version in one round-trip.
        await syncMedications(familyId, editingId, editingRelative.medications, medications);
        const refreshed = await api(`/api/families/${familyId}/relatives/${editingId}`);
        setFamily((list) =>
          list.map((person, index) =>
            person.id === editingId ? fromServerRelative(refreshed.relative, index) : person,
          ),
        );
      } else {
        const created = await api(`/api/families/${familyId}/relatives`, {
          method: "POST",
          body: JSON.stringify({ ...input, medications: normalizedMedications(medications) }),
        });
        setFamily((list) => [...list, fromServerRelative(created.relative, list.length)]);
        setSelectedId(created.relative.id);
      }

      showSaved();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível salvar o familiar.");
      return false;
    }
  }

  /**
   * Deletes the selected relative. The caller is responsible for confirming
   * the action with the person first (see `ConfirmDialog`); this function
   * performs the deletion unconditionally. Returns whether the family
   * became empty, so the caller can turn off emergency mode if needed.
   */
  async function deleteSelectedRelative(): Promise<boolean> {
    if (!selected || !familyId) return false;

    try {
      await api(`/api/families/${familyId}/relatives/${selected.id}?expectedVersion=${selected.version ?? 1}`, {
        method: "DELETE",
      });
      const remainingFamily = family.filter((person) => person.id !== selected.id);
      setFamily(remainingFamily);
      setSelectedId(remainingFamily[0]?.id ?? "");
      return remainingFamily.length === 0;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível excluir o familiar.");
      return false;
    }
  }

  async function addMedication(data: FormData): Promise<boolean> {
    if (!selected || !familyId) return false;

    const medication = createMedication(data);
    if (!medication.name) return false;

    try {
      const created = await api(`/api/families/${familyId}/relatives/${selected.id}/medications`, {
        method: "POST",
        body: JSON.stringify(toMedicationInput(medication)),
      });
      setFamily((list) =>
        list.map((person) =>
          person.id === selected.id
            ? { ...person, medications: [...person.medications, fromServerMedication(created.medication)] }
            : person,
        ),
      );
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível adicionar o medicamento.");
      return false;
    }
  }

  /** Removes a medication unconditionally; the caller confirms with the person first. */
  async function deleteMedication(index: number) {
    if (!selected || !familyId) return;
    const medication = selected.medications[index];
    if (!medication?.id) return;

    try {
      await api(
        `/api/families/${familyId}/relatives/${selected.id}/medications/${medication.id}?expectedVersion=${medication.version ?? 1}`,
        { method: "DELETE" },
      );
      setFamily((list) =>
        list.map((person) =>
          person.id === selected.id
            ? { ...person, medications: person.medications.filter((_, i) => i !== index) }
            : person,
        ),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível remover o medicamento.");
    }
  }

  async function confirmLocalImport() {
    if (!familyId || !pendingLocalImport) return;
    try {
      await api(`/api/families/${familyId}/import-local`, {
        method: "POST",
        body: JSON.stringify({ relatives: pendingLocalImport }),
      });
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      setPendingLocalImport(null);
      await loadRelatives(familyId);
      showSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível importar os dados salvos neste navegador.");
    }
  }

  function dismissLocalImport() {
    setPendingLocalImport(null);
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    window.location.reload();
  }

  return {
    authState,
    user,
    familyId,
    family,
    justSaved,
    error,
    clearError: () => setError(null),
    reportError: (message: string) => setError(message),
    selected,
    selectedId,
    selectRelative: setSelectedId,
    saveRelative,
    deleteSelectedRelative,
    addMedication,
    deleteMedication,
    pendingLocalImport,
    confirmLocalImport,
    dismissLocalImport,
    logout,
  };
}

function normalizedMedications(medications: readonly Medication[]) {
  return medications.map(normalizeMedication).filter((medication) => medication.name).map(toMedicationInput);
}
