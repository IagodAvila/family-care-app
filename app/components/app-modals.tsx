"use client";

import type { FormEvent } from "react";
import type { Medication, Relative } from "@/types/family";
import { MedicationFields } from "./medication-fields";
import { Modal } from "./modal";
import { RelativeForm } from "./relative-form";

type AppModalsProps = {
  editingRelative?: Relative;
  isEditingRelative: boolean;
  selected?: Relative;
  showMedicationForm: boolean;
  showPrivacy: boolean;
  showRelativeForm: boolean;
  onAddMedication: (data: FormData) => boolean;
  onCloseMedicationForm: () => void;
  onClosePrivacy: () => void;
  onCloseRelativeForm: () => void;
  onSaveRelative: (data: FormData, medications: Medication[]) => void;
};

export function AppModals({
  editingRelative,
  isEditingRelative,
  selected,
  showMedicationForm,
  showPrivacy,
  showRelativeForm,
  onAddMedication,
  onCloseMedicationForm,
  onClosePrivacy,
  onCloseRelativeForm,
  onSaveRelative,
}: AppModalsProps) {
  function addMedication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const wasAdded = onAddMedication(new FormData(event.currentTarget));
    if (wasAdded) onCloseMedicationForm();
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
              <button type="button" onClick={onCloseMedicationForm}>Cancelar</button>
              <button className="submit-button" type="submit">
                Adicionar medicamento
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
            Nesta demonstração, os dados ficam no seu aparelho.
          </h2>
          <p>
            As informações cadastradas são salvas somente no navegador deste
            dispositivo. Uma versão de produção deverá incluir acesso protegido,
            criptografia e consentimento de cada familiar.
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
    </>
  );
}
