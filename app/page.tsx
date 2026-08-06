"use client";

import { useEffect, useState } from "react";
import { AppFooter } from "./components/app-footer";
import { AppHeader } from "./components/app-header";
import { AppModals } from "./components/app-modals";
import { ConfirmDialog } from "./components/confirm-dialog";
import { EmptyFamilyRecord } from "./components/empty-family-record";
import { FamilyPanel } from "./components/family-panel";
import { LoginScreen } from "./components/login-screen";
import { MedicalRecord } from "./components/medical-record";
import { MembersPanel } from "./components/members-panel";
import { useFamilyStore } from "@/hooks/use-family-store";
import type { Medication } from "@/types/family";

export default function Home() {
  const {
    authState,
    user,
    familyId,
    family,
    justSaved,
    error,
    clearError,
    reportError,
    selected,
    selectRelative,
    saveRelative,
    deleteSelectedRelative,
    addMedication,
    deleteMedication,
    pendingLocalImport,
    confirmLocalImport,
    dismissLocalImport,
    logout,
  } = useFamilyStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showRelativeForm, setShowRelativeForm] = useState(false);
  const [showMedicationForm, setShowMedicationForm] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showDeleteRelativeConfirm, setShowDeleteRelativeConfirm] = useState(false);
  const [pendingMedicationIndex, setPendingMedicationIndex] = useState<number | null>(null);
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [justJoinedFamily, setJustJoinedFamily] = useState(false);

  // Landing here from an invitation link (see app/convite/[token]/page.tsx),
  // which redirects to `/?invited=1` or `/?inviteError=...` — surface the
  // result once, then drop it from the URL so a refresh doesn't repeat it.
  /* eslint-disable react-hooks/set-state-in-effect -- Reads a one-time invite-result flag from the URL on mount. */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteError = params.get("inviteError");
    const invited = params.get("invited");
    if (!inviteError && !invited) return;

    if (inviteError) reportError(inviteError);
    if (invited) {
      setJustJoinedFamily(true);
      window.setTimeout(() => setJustJoinedFamily(false), 4000);
    }
    window.history.replaceState(null, "", window.location.pathname);
  }, [reportError]);
  /* eslint-enable react-hooks/set-state-in-effect */

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

  async function handleSaveRelative(data: FormData, medications: Medication[]) {
    await saveRelative(editingId, data, medications);
    closeRelativeForm();
  }

  function requestDeleteRelative() {
    setShowDeleteRelativeConfirm(true);
  }

  async function confirmDeleteRelative() {
    setShowDeleteRelativeConfirm(false);
    const familyBecameEmpty = await deleteSelectedRelative();
    if (familyBecameEmpty) setEmergencyMode(false);
  }

  async function confirmRemoveMedication() {
    if (pendingMedicationIndex === null) return;
    await deleteMedication(pendingMedicationIndex);
    setPendingMedicationIndex(null);
  }

  function toggleEmergencyMode() {
    if (selected) setEmergencyMode((current) => !current);
  }

  if (authState === "loading") {
    return (
      <main className="app app-loading">
        <p>Carregando…</p>
      </main>
    );
  }

  if (authState === "needs-login") {
    return <LoginScreen error={error} />;
  }

  return (
    <main className={emergencyMode ? "app emergency-active" : "app"}>
      <AppHeader
        emergencyMode={emergencyMode}
        hasSelectedRelative={Boolean(selected)}
        user={user}
        onLogout={logout}
        onOpenMembers={() => setShowMembers(true)}
        onOpenPrivacy={() => setShowPrivacy(true)}
        onToggleEmergency={toggleEmergencyMode}
      />

      <section className="app-intro" id="inicio">
        <p>Dados de saúde da família, sincronizados com segurança na sua conta.</p>
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

      {justJoinedFamily && (
        <div className="save-toast" role="status" aria-live="polite">
          Convite aceito! Você agora faz parte da família.
        </div>
      )}

      {error && (
        <div className="save-toast error-toast" role="alert">
          {error}
          <button type="button" aria-label="Fechar aviso" onClick={clearError}>×</button>
        </div>
      )}

      {pendingLocalImport && (
        <ConfirmDialog
          titleId="import-local-title"
          title="Importar dados salvos neste navegador?"
          description={`Encontramos ${pendingLocalImport.length} familiar(es) salvos neste navegador de uma versão anterior do FamilyCare. Deseja importá-los para a sua conta? Os dados atuais deste navegador não serão apagados até a importação ser confirmada.`}
          confirmLabel="Importar"
          onCancel={dismissLocalImport}
          onConfirm={confirmLocalImport}
        />
      )}

      {showMembers && familyId && user && (
        <MembersPanel
          familyId={familyId}
          currentUserId={user.id}
          onClose={() => setShowMembers(false)}
          onError={reportError}
        />
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
