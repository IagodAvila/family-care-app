"use client";

import { useState } from "react";
import { AppFooter } from "./components/app-footer";
import { AppHeader } from "./components/app-header";
import { AppModals } from "./components/app-modals";
import { EmptyFamilyRecord } from "./components/empty-family-record";
import { FamilyPanel } from "./components/family-panel";
import { MedicalRecord } from "./components/medical-record";
import { useFamilyStore } from "@/hooks/use-family-store";
import type { Medication } from "@/types/family";

export default function Home() {
  const {
    family,
    justSaved,
    selected,
    selectRelative,
    saveRelative,
    deleteSelectedRelative,
    addMedication,
    deleteMedication,
  } = useFamilyStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showRelativeForm, setShowRelativeForm] = useState(false);
  const [showMedicationForm, setShowMedicationForm] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showDeleteRelativeConfirm, setShowDeleteRelativeConfirm] = useState(false);
  const [pendingMedicationIndex, setPendingMedicationIndex] = useState<number | null>(null);
  const [emergencyMode, setEmergencyMode] = useState(false);

  const editingRelative = family.find((person) => person.id === editingId);

  function openAddRelative() {
    setEditingId(null);
    setShowRelativeForm(true);
  }

  function openEditRelative() {
    if (!selected) return;
    setEditingId(selected.id);
    setShowRelativeForm(true);
  }

  function closeRelativeForm() {
    setShowRelativeForm(false);
    setEditingId(null);
  }

  function handleSaveRelative(data: FormData, medications: Medication[]) {
    saveRelative(editingId, data, medications);
    closeRelativeForm();
  }

  function requestDeleteRelative() {
    setShowDeleteRelativeConfirm(true);
  }

  function confirmDeleteRelative() {
    setShowDeleteRelativeConfirm(false);
    const familyBecameEmpty = deleteSelectedRelative();
    if (familyBecameEmpty) setEmergencyMode(false);
  }

  function confirmRemoveMedication() {
    if (pendingMedicationIndex === null) return;
    deleteMedication(pendingMedicationIndex);
    setPendingMedicationIndex(null);
  }

  function toggleEmergencyMode() {
    if (selected) setEmergencyMode((current) => !current);
  }

  return (
    <main className={emergencyMode ? "app emergency-active" : "app"}>
      <AppHeader
        emergencyMode={emergencyMode}
        hasSelectedRelative={Boolean(selected)}
        onOpenPrivacy={() => setShowPrivacy(true)}
        onToggleEmergency={toggleEmergencyMode}
      />

      <section className="app-intro" id="inicio">
        <p>Dados de saúde da família, organizados neste dispositivo.</p>
      </section>

      <section className="workspace" id="familiares">
        <FamilyPanel
          family={family}
          selectedId={selected?.id}
          onAddRelative={openAddRelative}
          onSelectRelative={selectRelative}
        />

        {selected ? (
          <MedicalRecord
            emergencyMode={emergencyMode}
            family={family}
            selected={selected}
            onAddMedication={() => setShowMedicationForm(true)}
            onDeleteRelative={requestDeleteRelative}
            onEditRelative={openEditRelative}
            onRemoveMedication={setPendingMedicationIndex}
            onSelectRelative={selectRelative}
          />
        ) : (
          <EmptyFamilyRecord onAddRelative={openAddRelative} />
        )}
      </section>

      <AppFooter onOpenPrivacy={() => setShowPrivacy(true)} />

      {justSaved && (
        <div className="save-toast" role="status" aria-live="polite">
          Alterações salvas
        </div>
      )}

      <AppModals
        editingRelative={editingRelative}
        isEditingRelative={Boolean(editingId)}
        pendingMedicationIndex={pendingMedicationIndex}
        selected={selected}
        showDeleteRelativeConfirm={showDeleteRelativeConfirm}
        showMedicationForm={showMedicationForm}
        showPrivacy={showPrivacy}
        showRelativeForm={showRelativeForm}
        onAddMedication={addMedication}
        onCancelDeleteRelative={() => setShowDeleteRelativeConfirm(false)}
        onCancelRemoveMedication={() => setPendingMedicationIndex(null)}
        onCloseMedicationForm={() => setShowMedicationForm(false)}
        onClosePrivacy={() => setShowPrivacy(false)}
        onCloseRelativeForm={closeRelativeForm}
        onConfirmDeleteRelative={confirmDeleteRelative}
        onConfirmRemoveMedication={confirmRemoveMedication}
        onSaveRelative={handleSaveRelative}
      />
    </main>
  );
}
