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
import { api } from "@/lib/api-client";
import { isNoDataValue, NO_DATA_LABEL } from "@/lib/family-format";
import { MAX_PHOTO_FILE_SIZE, resizePhotoToDataUrl } from "@/lib/photo";
import type { Medication, Relative } from "@/types/family";
import { PersonAvatar } from "./person-avatar";

type AssistResult = {
  conditions: string[];
  allergies: string[];
  medications: { name: string; dosage: string; orientation: string }[];
};

type RelativeFormProps = {
  relative?: Relative;
  isEditing: boolean;
  onCancel: () => void;
  onSave: (data: FormData, medications: Medication[]) => void | Promise<void>;
};

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Não sei"];
const EMPTY_MEDICATION: Medication = { name: "", dosage: "", orientation: "" };

type YesNoFieldProps = {
  label: string;
  name: string;
  placeholder: string;
  initialValues: string[];
};

/**
 * Comorbidades/Alergias: a written list, or a flat "Não possui" — asked for
 * explicitly rather than inferred from an empty field, so a blank field
 * still reads as "not filled in yet" instead of "checked, has none".
 * Whichever synonym is already stored (see `isNoDataValue`) still lands
 * back on the "Não possui" toggle when editing, so re-saving standardizes
 * older entries onto the current wording.
 */
function YesNoField({ label, name, placeholder, initialValues }: YesNoFieldProps) {
  const initialIsNone = initialValues.length === 1 && isNoDataValue(initialValues[0]);
  const [mode, setMode] = useState<"describe" | "none">(initialIsNone ? "none" : "describe");
  const [text, setText] = useState(initialIsNone ? "" : initialValues.join(", "));

  return (
    <div className="full field-group">
      <span className="field-group-label">{label}</span>
      <div className="field-mode-toggle" role="group" aria-label={`Status: ${label}`}>
        <button
          type="button"
          className={mode === "describe" ? "active" : undefined}
          aria-pressed={mode === "describe"}
          onClick={() => setMode("describe")}
        >
          Descrever
        </button>
        <button
          type="button"
          className={mode === "none" ? "active" : undefined}
          aria-pressed={mode === "none"}
          onClick={() => setMode("none")}
        >
          Não possui
        </button>
      </div>
      {mode === "describe" ? (
        <input
          name={name}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={placeholder}
          aria-label={label}
        />
      ) : (
        <input type="hidden" name={name} value={NO_DATA_LABEL} />
      )}
    </div>
  );
}

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
  const [submitting, setSubmitting] = useState(false);

  // AI-assisted fill-in: free text -> structured suggestions for
  // comorbidities/alergias/medicamentos. `conditionsSeed`/`allergiesSeed`
  // feed YesNoField's `initialValues` — that component only reads the prop
  // on mount, so `assistVersion` forces a remount to pick up a new seed
  // (see YesNoField's docstring). A field is only overwritten when the
  // suggestion actually says something about it — an empty result leaves
  // whatever the person already typed alone.
  const [assistText, setAssistText] = useState("");
  const [assisting, setAssisting] = useState(false);
  const [assistError, setAssistError] = useState("");
  const [assistNote, setAssistNote] = useState("");
  const [conditionsSeed, setConditionsSeed] = useState(relative?.conditions ?? []);
  const [allergiesSeed, setAllergiesSeed] = useState(relative?.allergies ?? []);
  const [assistVersion, setAssistVersion] = useState(0);

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

  async function runAssist() {
    if (!assistText.trim() || assisting) return;
    setAssisting(true);
    setAssistError("");
    setAssistNote("");
    try {
      const result: AssistResult = await api("/api/assist/relative-fields", {
        method: "POST",
        body: JSON.stringify({ text: assistText }),
      });

      const appliedTo: string[] = [];
      if (result.conditions.length > 0) {
        setConditionsSeed(result.conditions);
        appliedTo.push("comorbidades");
      }
      if (result.allergies.length > 0) {
        setAllergiesSeed(result.allergies);
        appliedTo.push("alergias");
      }
      if (result.medications.length > 0) {
        setMedications((current) =>
          result.medications.reduce(
            (list, medication) => addMedicationToList(list, medication),
            current,
          ),
        );
        appliedTo.push("medicamentos");
      }
      setAssistVersion((current) => current + 1);
      setAssistNote(
        appliedTo.length > 0
          ? `Sugestões aplicadas em ${appliedTo.join(", ")} — revise antes de salvar.`
          : "Não encontrei nada específico nesse texto para preencher.",
      );
    } catch (caught) {
      setAssistError(
        caught instanceof Error ? caught.message : "Não foi possível gerar sugestões agora.",
      );
    } finally {
      setAssisting(false);
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // A slow save shouldn't invite a second click that creates a duplicate
    // — the button below is disabled while this is in flight, but the
    // guard here covers any other way the form could re-submit meanwhile.
    if (submitting) return;

    const result = validateBirthDate(birthDate);
    if (result.error) {
      setBirthDateError(result.error);
      return;
    }

    const data = new FormData(event.currentTarget);
    data.set("birthDate", result.internalDate ?? displayDateToInternal(birthDate));
    data.set("photoUrl", photoUrl ?? "");
    setSubmitting(true);
    try {
      await onSave(data, medications);
    } finally {
      setSubmitting(false);
    }
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

      <div className="ai-assist">
        <label>
          <span className="field-label-text">Preenchimento assistido (opcional)</span>
          <textarea
            value={assistText}
            onChange={(event) => setAssistText(event.target.value)}
            placeholder="Ex.: Ela tem pressão alta, toma losartana 50mg à noite, e é alérgica a dipirona."
          />
        </label>
        <div className="ai-assist-actions">
          <button type="button" onClick={runAssist} disabled={assisting || !assistText.trim()}>
            {assisting ? "Analisando…" : "Sugerir preenchimento com IA"}
          </button>
          <span className="ai-assist-hint">
            Preenche comorbidades, alergias e medicamentos abaixo — revise antes de salvar.
          </span>
        </div>
        {assistError && (
          <p className="field-error" role="alert">{assistError}</p>
        )}
        {assistNote && (
          <p className="ai-assist-note" role="status">{assistNote}</p>
        )}
      </div>

      <p className="required-legend">* Campos obrigatórios</p>

      <div className="form-grid">
        <label>
          <span className="field-label-text">Nome completo</span>
          <input
            name="name"
            required
            placeholder="Ex.: Carlos Almeida"
            defaultValue={relative?.name ?? ""}
          />
        </label>
        <label>
          <span className="field-label-text">Parentesco</span>
          <input
            name="relation"
            required
            placeholder="Ex.: Avô"
            defaultValue={relative?.relation ?? ""}
          />
        </label>
        <label>
          <span className="field-label-text">Data de nascimento</span>
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
          <span className="field-label-text">Tipo sanguíneo</span>
          <select name="bloodType" required defaultValue={relative?.bloodType ?? ""}>
            <option value="" disabled>Selecione</option>
            {BLOOD_TYPES.map((type) => <option key={type}>{type}</option>)}
          </select>
        </label>
        <YesNoField
          key={`conditions-${assistVersion}`}
          label="Comorbidades, separadas por vírgula"
          name="conditions"
          placeholder="Hipertensão, diabetes"
          initialValues={conditionsSeed}
        />
        <YesNoField
          key={`allergies-${assistVersion}`}
          label="Alergias, separadas por vírgula"
          name="allergies"
          placeholder="Dipirona, amoxicilina"
          initialValues={allergiesSeed}
        />
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
        <button type="button" onClick={onCancel} disabled={submitting}>Cancelar</button>
        <button className="submit-button" type="submit" disabled={processingPhoto || submitting}>
          {submitting ? "Salvando…" : isEditing ? "Salvar alterações" : "Salvar familiar"}
        </button>
      </div>
    </form>
  );
}
