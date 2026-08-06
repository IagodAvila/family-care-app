"use client";

import { useEffect, useRef, useState } from "react";
import {
  formatDate,
  getAge,
  getMedicationTiming,
} from "@/lib/family-format";
import type { Relative } from "@/types/family";
import { PersonAvatar } from "./person-avatar";

type MedicalRecordProps = {
  emergencyMode: boolean;
  family: Relative[];
  selected: Relative;
  onAddMedication: () => void;
  onDeleteRelative: () => void;
  onEditRelative: () => void;
  onRemoveMedication: (index: number) => void;
  onSelectRelative: (id: string) => void;
};

export function MedicalRecord({
  emergencyMode,
  family,
  selected,
  onAddMedication,
  onDeleteRelative,
  onEditRelative,
  onRemoveMedication,
  onSelectRelative,
}: MedicalRecordProps) {
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const moreOptionsRef = useRef<HTMLDivElement>(null);
  const moreOptionsButtonRef = useRef<HTMLButtonElement>(null);
  const deleteActionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!showMoreOptions) return;
    deleteActionRef.current?.focus();

    function closeMenu(event: MouseEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent && event.key === "Escape") {
        event.preventDefault();
        setShowMoreOptions(false);
        moreOptionsButtonRef.current?.focus();
      }

      if (
        event instanceof MouseEvent
        && !moreOptionsRef.current?.contains(event.target as Node)
      ) {
        setShowMoreOptions(false);
        moreOptionsButtonRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", closeMenu);
    document.addEventListener("keydown", closeMenu);
    return () => {
      document.removeEventListener("mousedown", closeMenu);
      document.removeEventListener("keydown", closeMenu);
    };
  }, [showMoreOptions]);

  function deleteRelative() {
    setShowMoreOptions(false);
    onDeleteRelative();
  }

  return (
    <article className="medical-record">
      {emergencyMode && (
        <div className="quick-family-switcher">
          <label htmlFor="quick-family-select">Familiar em emergência</label>
          <div className="quick-family-control">
            <PersonAvatar
              name={selected.name}
              color={selected.color}
              photoUrl={selected.photoUrl}
              className="quick-avatar"
            />
            <select
              id="quick-family-select"
              value={selected.id}
              onChange={(event) => onSelectRelative(event.target.value)}
              aria-label="Selecionar familiar no modo emergência"
            >
              {family.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name} — {person.relation}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="record-header">
        <div className="identity">
          <PersonAvatar
            name={selected.name}
            color={selected.color}
            photoUrl={selected.photoUrl}
            className="avatar-large"
          />
          <div>
            <span className="relation-label">{selected.relation}</span>
            <h2>{selected.name}</h2>
            <p>{formatDate(selected.birthDate)} · {getAge(selected.birthDate)} anos</p>
          </div>
        </div>

        {!emergencyMode && (
          <div className="record-actions">
            <button className="edit-button" type="button" onClick={onEditRelative}>
              <span aria-hidden="true">✎</span> Editar familiar
            </button>
            <div className="more-options" ref={moreOptionsRef}>
              <button
                className="more-options-button"
                ref={moreOptionsButtonRef}
                type="button"
                aria-label="Mais opções para este familiar"
                aria-haspopup="true"
                aria-controls="more-options-popover"
                aria-expanded={showMoreOptions}
                onClick={() => setShowMoreOptions((current) => !current)}
              >
                ⋯
              </button>
              {showMoreOptions && (
                <div className="more-options-menu" id="more-options-popover">
                  <button
                    className="delete-menu-item"
                    ref={deleteActionRef}
                    type="button"
                    onClick={deleteRelative}
                  >
                    Excluir familiar
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="vitals-grid">
        <section className="vital-card blood-card">
          <span className="card-icon" aria-hidden="true">●</span>
          <div>
            <small>Tipo sanguíneo</small>
            <strong>{selected.bloodType}</strong>
          </div>
        </section>
        <section className="vital-card">
          <span className="card-icon heart" aria-hidden="true">♥</span>
          <div>
            <small>Comorbidades</small>
            <div className="chips">
              {selected.conditions.length
                ? selected.conditions.map((item) => <span key={item}>{item}</span>)
                : <span className="chip-neutral">Nenhuma informada</span>}
            </div>
          </div>
        </section>
        <section className="vital-card allergy-card">
          <span className="card-icon" aria-hidden="true">!</span>
          <div>
            <small>Alergias</small>
            <div className="chips">
              {selected.allergies.length
                ? selected.allergies.map((item) => <span key={item}>{item}</span>)
                : <span className="chip-neutral">Nenhuma informada</span>}
            </div>
          </div>
        </section>
      </div>

      <section className="medications-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{emergencyMode ? "Consulta rápida" : "Uso contínuo"}</p>
            <h3>{emergencyMode ? "Medicamentos em uso" : "Medicamentos"}</h3>
          </div>
          {!emergencyMode && (
            <div className="medication-heading-actions">
              <span>
                {selected.medications.length}{" "}
                {selected.medications.length === 1 ? "medicamento" : "medicamentos"}
              </span>
              <button type="button" onClick={onAddMedication}>
                <span aria-hidden="true">＋</span> Adicionar
              </button>
            </div>
          )}
        </div>

        {selected.medications.length ? (
          <div className="medication-list">
            {selected.medications.map((medication, index) => (
              <div
                className="medication-row"
                key={`${medication.name}-${medication.dosage}-${index}`}
              >
                <span className="pill-icon" aria-hidden="true">◐</span>
                <div>
                  <strong>{medication.name}</strong>
                  <small>{getMedicationTiming(medication)}</small>
                </div>
                <b>{medication.dosage}</b>
                {!emergencyMode && (
                  <button
                    className="remove-medication"
                    type="button"
                    aria-label={`Remover ${medication.name}`}
                    title={`Remover ${medication.name}`}
                    onClick={() => onRemoveMedication(index)}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-medications">
            {emergencyMode
              ? "Nenhum medicamento informado."
              : "Nenhum medicamento cadastrado."}
          </div>
        )}
      </section>

      {selected.notes && (
        <section className="notes">
          <strong>Observação importante</strong>
          <p>{selected.notes}</p>
        </section>
      )}
    </article>
  );
}
