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
    selected,
    selectRelative,
    saveRelative,
    removeSelectedRelative,
    addMedication,
    removeMedication,
  } = useFamilyStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showRelativeForm, setShowRelativeForm] = useState(false);
  const [showMedicationForm, setShowMedicationForm] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
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

  function handleDeleteRelative() {
    const familyBecameEmpty = removeSelectedRelative();
    if (familyBecameEmpty) setEmergencyMode(false);
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
            onDeleteRelative={handleDeleteRelative}
            onEditRelative={openEditRelative}
            onRemoveMedication={removeMedication}
            onSelectRelative={selectRelative}
          />
        ) : (
          <EmptyFamilyRecord onAddRelative={openAddRelative} />
        )}
      </section>

      <AppFooter onOpenPrivacy={() => setShowPrivacy(true)} />

      <AppModals
        editingRelative={editingRelative}
        isEditingRelative={Boolean(editingId)}
        selected={selected}
        showMedicationForm={showMedicationForm}
        showPrivacy={showPrivacy}
        showRelativeForm={showRelativeForm}
        onAddMedication={addMedication}
        onCloseMedicationForm={() => setShowMedicationForm(false)}
        onClosePrivacy={() => setShowPrivacy(false)}
        onCloseRelativeForm={closeRelativeForm}
        onSaveRelative={handleSaveRelative}
      />
    </main>
  );
}
