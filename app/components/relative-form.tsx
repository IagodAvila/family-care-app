"use client";

import { type ChangeEvent, type FormEvent, useState } from "react";
import {
  addMedicationToList,
  applyDateMask,
  displayDateToInternal,
  internalDateToDisplay,
  removeMedicationFromList,
  updateMedicationInList,
  validateBirthDate,
} from "@/lib/family-data";
import { MAX_PHOTO_FILE_SIZE, resizePhotoToDataUrl } from "@/lib/photo";
import type { Medication, Relative } from "@/types/family";
import { PersonAvatar } from "./person-avatar";

type RelativeFormProps = {
  relative?: Relative;
  isEditing: boolean;
  onCancel: () => void;
  onSave: (data: FormData, medications: Medication[]) => void;
};

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Não sei"];
const EMPTY_MEDICATION: Medication = { name: "", dosage: "", orientation: "" };

export function RelativeForm({
  relative,
  isEditing,
  onCancel,
  onSave,
}: RelativeFormProps) {
  const [birthDate, setBirthDate] = useState(() =>
    internalDateToDisplay(relative?.birthDate ?? ""),
  );
  const [birthDateError, setBirthDateError] = useState("");
  const [medications, setMedications] = useState<Medication[]>(
    () => relative?.medications ?? [],
  );
  const [medicationError, setMedicationError] = useState("");
  const [medicationDraft, setMedicationDraft] = useState<Medication>(EMPTY_MEDICATION);
  const [editingMedicationIndex, setEditingMedicationIndex] = useState<number | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(relative?.photoUrl ?? null);
  const [photoError, setPhotoError] = useState("");
  const [processingPhoto, setProcessingPhoto] = useState(false);

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setPhotoError("Selecione um arquivo de imagem.");
      return;
    }
    if (file.size > MAX_PHOTO_FILE_SIZE) {
      setPhotoError("A imagem é muito grande (máximo 12 MB).");
      return;
    }

    setPhotoError("");
    setProcessingPhoto(true);
    try {
      setPhotoUrl(await resizePhotoToDataUrl(file));
    } catch {
      setPhotoError("Não foi possível processar essa imagem. Tente outro arquivo.");
    } finally {
      setProcessingPhoto(false);
    }
  }

  function addTemporaryMedication() {
    if (!medicationDraft.name.trim()) {
      setMedicationError("Informe o nome do medicamento antes de adicioná-lo.");
      return;
    }

    const medication = { ...medicationDraft, name: medicationDraft.name.trim() };
    setMedications((current) =>
      editingMedicationIndex === null
        ? addMedicationToList(current, medication)
        : updateMedicationInList(current, editingMedicationIndex, medication),
    );
    setMedicationError("");
    setMedicationDraft(EMPTY_MEDICATION);
    setEditingMedicationIndex(null);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateBirthDate(birthDate);

    if (result.error) {
      setBirthDateError(result.error);
      return;
    }

    const data = new FormData(event.currentTarget);
    data.set("birthDate", result.internalDate ?? displayDateToInternal(birthDate));
    data.set("photoUrl", photoUrl ?? "");
    onSave(data, medications);
  }

  function editTemporaryMedication(medication: Medication, index: number) {
    setMedicationDraft(medication);
    setEditingMedicationIndex(index);
    setMedicationError("");
  }

  function removeTemporaryMedication(index: number) {
    setMedications((current) => removeMedicationFromList(current, index));

    if (editingMedicationIndex === index) {
      setMedicationDraft(EMPTY_MEDICATION);
      setEditingMedicationIndex(null);
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="photo-field">
        <PersonAvatar name={relative?.name ?? ""} color={relative?.color ?? "#277f7b"} photoUrl={photoUrl} className="avatar-large" />
        <div className="photo-field-controls">
          <div className="photo-actions">
            <label className="photo-upload-label">
              {photoUrl ? "Trocar foto" : "Adicionar foto"}
              <input type="file" accept="image/*" onChange={handlePhotoChange} disabled={processingPhoto} />
            </label>
            {photoUrl && (
              <button type="button" className="remove-photo-button" onClick={() => setPhotoUrl(null)}>
                Remover foto
              </button>
            )}
          </div>
          {processingPhoto && <p className="photo-processing">Processando imagem…</p>}
          {photoError && (
            <p className="field-error" role="alert">{photoError}</p>
          )}
        </div>
      </div>

      <div className="form-grid">
        <label>
          Nome completo
          <input
            name="name"
            required
            placeholder="Ex.: Carlos Almeida"
            defaultValue={relative?.name ?? ""}
          />
        </label>
        <label>
          Parentesco
          <input
            name="relation"
            required
            placeholder="Ex.: Avô"
            defaultValue={relative?.relation ?? ""}
          />
        </label>
        <label>
          Data de nascimento
          <input
            id="birthDate"
            name="birthDateDisplay"
            inputMode="numeric"
            autoComplete="bday"
            maxLength={10}
            required
            value={birthDate}
            onChange={(event) => {
              setBirthDate(applyDateMask(event.target.value));
              setBirthDateError("");
            }}
            placeholder="DD/MM/AAAA"
            aria-invalid={Boolean(birthDateError)}
            aria-describedby={birthDateError ? "birthDate-error" : undefined}
          />
          {birthDateError && (
            <span className="field-error" id="birthDate-error" role="alert">
              {birthDateError}
            </span>
          )}
        </label>
        <label>
          Tipo sanguíneo
          <select name="bloodType" required defaultValue={relative?.bloodType ?? ""}>
            <option value="" disabled>Selecione</option>
            {BLOOD_TYPES.map((type) => <option key={type}>{type}</option>)}
          </select>
        </label>
        <label className="full">
          Comorbidades, separadas por vírgula
          <input
            name="conditions"
            placeholder="Hipertensão, diabetes"
            defaultValue={relative?.conditions.join(", ") ?? ""}
          />
        </label>
        <label className="full">
          Alergias, separadas por vírgula
          <input
            name="allergies"
            placeholder="Dipirona, amoxicilina"
            defaultValue={relative?.allergies.join(", ") ?? ""}
          />
        </label>
      </div>

      <fieldset>
        <legend>Medicamentos em uso</legend>
        <div className="temporary-medication-form">
          <div className="form-grid medication-fields">
            <label>
              Nome
              <input
                id="temporary-medication-name"
                value={medicationDraft.name}
                onChange={(event) => {
                  setMedicationDraft((current) => ({ ...current, name: event.target.value }));
                  setMedicationError("");
                }}
                placeholder="Ex.: Losartana"
                aria-invalid={Boolean(medicationError)}
                aria-describedby={medicationError ? "temporary-medication-error" : undefined}
              />
            </label>
            <label>
              Dosagem ou apresentação
              <input
                value={medicationDraft.dosage}
                onChange={(event) =>
                  setMedicationDraft((current) => ({
                    ...current,
                    dosage: event.target.value,
                  }))
                }
                placeholder="Ex.: 50 mg"
              />
            </label>
            <label className="full">
              Orientação de uso
              <input
                value={medicationDraft.orientation ?? ""}
                onChange={(event) =>
                  setMedicationDraft((current) => ({
                    ...current,
                    orientation: event.target.value,
                  }))
                }
                placeholder="Ex.: Tomar a cada 8 horas por 7 dias"
              />
            </label>
          </div>

          {medicationError && (
            <p className="field-error" id="temporary-medication-error" role="alert">
              {medicationError}
            </p>
          )}

          <button
            className="add-temporary-medication"
            type="button"
            onClick={addTemporaryMedication}
          >
            {editingMedicationIndex === null
              ? "Adicionar medicamento"
              : "Salvar medicamento"}
          </button>
        </div>

        {medications.length > 0 && (
          <ul className="temporary-medication-list" aria-label="Medicamentos adicionados">
            {medications.map((medication, index) => (
              <li key={`${medication.name}-${index}`}>
                <span>
                  <strong>{medication.name}</strong>
                  {medication.dosage && <small>{medication.dosage}</small>}
                  {medication.orientation && <small>{medication.orientation}</small>}
                </span>
                <span className="temporary-medication-actions">
                  <button
                    type="button"
                    aria-label={`Editar ${medication.name}`}
                    onClick={() => editTemporaryMedication(medication, index)}
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    aria-label={`Remover ${medication.name}`}
                    onClick={() => removeTemporaryMedication(index)}
                  >
                    ×
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      <label className={isEditing ? "edit-notes" : ""}>
        Observações
        <textarea
          name="notes"
          placeholder="Histórico clínico ou orientação importante"
          defaultValue={relative?.notes ?? ""}
        />
      </label>

      <div className="form-actions">
        <button type="button" onClick={onCancel}>Cancelar</button>
        <button className="submit-button" type="submit" disabled={processingPhoto}>
          {isEditing ? "Salvar alterações" : "Salvar familiar"}
        </button>
      </div>
    </form>
  );
}
