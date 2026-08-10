"use client";

import { type FormEvent, useState } from "react";
import type { Medication, Relative } from "@/types/family";
import { ConfirmDialog } from "./confirm-dialog";
import { MedicationFields } from "./medication-fields";
import { Modal } from "./modal";
import { RelativeForm } from "./relative-form";

type AppModalsProps = {
  editingRelative?: Relative;
  isEditingRelative: boolean;
  pendingMedicationIndex: number | null;
  selected?: Relative;
  showDeleteRelativeConfirm: boolean;
  showMedicationForm: boolean;
  showPrivacy: boolean;
  showRelativeForm: boolean;
  onAddMedication: (data: FormData) => Promise<boolean>;
  onCancelDeleteRelative: () => void;
  onCancelRemoveMedication: () => void;
  onCloseMedicationForm: () => void;
  onClosePrivacy: () => void;
  onCloseRelativeForm: () => void;
  onConfirmDeleteRelative: () => void;
  onConfirmRemoveMedication: () => void;
  onSaveRelative: (data: FormData, medications: Medication[]) => void | Promise<void>;
};

export function AppModals({
  editingRelative,
  isEditingRelative,
  pendingMedicationIndex,
  selected,
  showDeleteRelativeConfirm,
  showMedicationForm,
  showPrivacy,
  showRelativeForm,
  onAddMedication,
  onCancelDeleteRelative,
  onCancelRemoveMedication,
  onCloseMedicationForm,
  onClosePrivacy,
  onCloseRelativeForm,
  onConfirmDeleteRelative,
  onConfirmRemoveMedication,
  onSaveRelative,
}: AppModalsProps) {
  const pendingMedication = pendingMedicationIndex !== null
    ? selected?.medications[pendingMedicationIndex]
    : undefined;
  const [addingMedication, setAddingMedication] = useState(false);
  async function addMedication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Same guard as RelativeForm's submit: without it, a slow request plus
    // an impatient second click can create the medication twice.
    if (addingMedication) return;
    setAddingMedication(true);
    try {
      const wasAdded = await onAddMedication(new FormData(event.currentTarget));
      if (wasAdded) onCloseMedicationForm();
    } finally {
      setAddingMedication(false);
    }
  }

  return (
    <>
      {showRelativeForm && (
        <Modal
          titleId="form-title"
          initialFocusSelector='input[name="name"]'
          onClose={onCloseRelativeForm}
        >
          <div className="modal-header">
            <div>
              <p className="eyebrow">
                {isEditingRelative ? "Atualizar cadastro" : "Nova pessoa"}
              </p>
              <h2 id="form-title">
                {isEditingRelative ? "Editar familiar" : "Adicionar familiar"}
              </h2>
            </div>
            <button type="button" aria-label="Fechar" onClick={onCloseRelativeForm}>
              ×
            </button>
          </div>
          <RelativeForm
            relative={editingRelative}
            isEditing={isEditingRelative}
            onSave={onSaveRelative}
            onCancel={onCloseRelativeForm}
          />
        </Modal>
      )}

      {showMedicationForm && selected && (
        <Modal
          className="medication-modal"
          titleId="medication-form-title"
          initialFocusSelector='input[name="name"]'
          onClose={onCloseMedicationForm}
        >
          <div className="modal-header">
            <div>
              <p className="eyebrow">{selected.name}</p>
              <h2 id="medication-form-title">Adicionar medicamento</h2>
            </div>
            <button type="button" aria-label="Fechar" onClick={onCloseMedicationForm}>
              ×
            </button>
          </div>
          <form onSubmit={addMedication}>
            <MedicationFields />
            <div className="form-actions">
              <button type="button" onClick={onCloseMedicationForm} disabled={addingMedication}>
                Cancelar
              </button>
              <button className="submit-button" type="submit" disabled={addingMedication}>
                {addingMedication ? "Adicionando…" : "Adicionar medicamento"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showPrivacy && (
        <Modal
          className="privacy-modal"
          titleId="privacy-title"
          initialFocusSelector="[data-modal-primary]"
          onClose={onClosePrivacy}
        >
          <div className="privacy-symbol">⌂</div>
          <p className="eyebrow">Privacidade desde o início</p>
          <h2 id="privacy-title">
            Seus dados ficam protegidos na sua conta.
          </h2>
          <p>
            As informações cadastradas são salvas com segurança, atrás do seu
            login com Google. Nesta versão, apenas você tem acesso a elas;
            compartilhar o acesso com outros familiares está previsto para uma
            etapa futura.
          </p>
          <button
            className="submit-button"
            data-modal-primary
            type="button"
            onClick={onClosePrivacy}
          >
            Entendi
          </button>
        </Modal>
      )}

      {showDeleteRelativeConfirm && selected && (
        <ConfirmDialog
          titleId="delete-relative-title"
          tone="danger"
          title={`Excluir ${selected.name}?`}
          description={`Todos os dados de ${selected.name}, incluindo medicamentos, serão excluídos permanentemente. Esta ação não pode ser desfeita.`}
          confirmLabel="Excluir familiar"
          onCancel={onCancelDeleteRelative}
          onConfirm={onConfirmDeleteRelative}
        />
      )}

      {pendingMedication && (
        <ConfirmDialog
          titleId="remove-medication-title"
          tone="danger"
          title={`Remover ${pendingMedication.name}?`}
          description={`${pendingMedication.name} deixará de aparecer nos medicamentos de ${selected?.name}.`}
          confirmLabel="Remover medicamento"
          onCancel={onCancelRemoveMedication}
          onConfirm={onConfirmRemoveMedication}
        />
      )}
    </>
  );
}
