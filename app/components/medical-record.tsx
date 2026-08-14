"use client";

import { useEffect, useRef, useState } from "react";
import {
  Droplet,
  HeartPulse,
  MoreHorizontal,
  Pencil,
  Pill,
  Plus,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  formatDate,
  getAge,
  getMedicationTiming,
  isNoDataValue,
  NO_DATA_LABEL,
} from "@/lib/family-format";
import type { Relative } from "@/types/family";
import { MedicationSchedules } from "./medication-schedules";
import { PersonAvatar } from "./person-avatar";
import { TodayDoses } from "./today-doses";

type MedicalRecordProps = {
  emergencyMode: boolean;
  family: Relative[];
  familyId: string | null;
  selected: Relative;
  onAddMedication: () => void;
  onDeleteRelative: () => void;
  onEditRelative: () => void;
  onRemoveMedication: (index: number) => void;
  onSelectRelative: (id: string) => void;
  onToggleEmergency: () => void;
};

const ICON_STROKE = 1.75;

export function MedicalRecord({
  emergencyMode,
  family,
  familyId,
  selected,
  onAddMedication,
  onDeleteRelative,
  onEditRelative,
  onRemoveMedication,
  onSelectRelative,
  onToggleEmergency,
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
    <article className="medical-record" id="ficha-familiar">
      {/* The single most critical action on this screen — kept dominant and
          on its own row rather than competing with the theme toggle/avatar
          in the top bar. On mobile this becomes a fixed bottom bar (see
          globals.css) so it stays reachable without scrolling back up. */}
      <div className="emergency-bar">
        <button
          className={emergencyMode ? "emergency-button active" : "emergency-button"}
          type="button"
          onClick={onToggleEmergency}
          aria-pressed={emergencyMode}
        >
          <TriangleAlert aria-hidden="true" size={18} strokeWidth={ICON_STROKE} />
          {emergencyMode ? "Sair do modo emergência" : "Modo emergência"}
        </button>
      </div>

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
              <Pencil aria-hidden="true" size={14} strokeWidth={ICON_STROKE} />
              Editar familiar
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
                <MoreHorizontal aria-hidden="true" size={18} strokeWidth={ICON_STROKE} />
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
          <span className="card-icon" aria-hidden="true">
            <Droplet size={18} strokeWidth={ICON_STROKE} />
          </span>
          <div>
            <small>Tipo sanguíneo</small>
            <strong>{selected.bloodType}</strong>
          </div>
        </section>
        <section className="vital-card">
          <span className="card-icon heart" aria-hidden="true">
            <HeartPulse size={18} strokeWidth={ICON_STROKE} />
          </span>
          <div>
            <small>Comorbidades</small>
            {selected.conditions.length ? (
              <div className="chips">
                {selected.conditions.map((item) => (
                  <span key={item} className={isNoDataValue(item) ? "chip-none" : undefined}>
                    {isNoDataValue(item) ? NO_DATA_LABEL : item}
                  </span>
                ))}
              </div>
            ) : (
              <button type="button" className="chip-cta" onClick={onEditRelative}>
                <TriangleAlert aria-hidden="true" size={13} strokeWidth={ICON_STROKE} />
                Registrar comorbidades
              </button>
            )}
          </div>
        </section>
        <section className="vital-card allergy-card">
          <span className="card-icon alert" aria-hidden="true">
            <TriangleAlert size={18} strokeWidth={ICON_STROKE} />
          </span>
          <div>
            <small>Alergias</small>
            {selected.allergies.length ? (
              <div className="chips">
                {selected.allergies.map((item) => (
                  <span key={item} className={isNoDataValue(item) ? "chip-none" : undefined}>
                    {isNoDataValue(item) ? NO_DATA_LABEL : item}
                  </span>
                ))}
              </div>
            ) : (
              <button type="button" className="chip-cta" onClick={onEditRelative}>
                <TriangleAlert aria-hidden="true" size={13} strokeWidth={ICON_STROKE} />
                Registrar alergias
              </button>
            )}
          </div>
        </section>
      </div>

      {selected.notes && (
        <section className="notes">
          <strong>Observação importante</strong>
          <p>{selected.notes}</p>
        </section>
      )}

      <section className="medications-section">
        <div className="section-heading">
          <h3>{emergencyMode ? "Medicamentos em uso" : "Medicamentos"}</h3>
          {!emergencyMode && (
            <div className="medication-heading-actions">
              <button type="button" onClick={onAddMedication}>
                <Plus aria-hidden="true" size={14} strokeWidth={ICON_STROKE} />
                Adicionar
              </button>
            </div>
          )}
        </div>

        {selected.medications.length ? (
          <div className="medication-list">
            {selected.medications.map((medication, index) => (
              <div
                className="medication-list-item"
                key={`${medication.name}-${medication.dosage}-${index}`}
              >
                <div className="medication-row">
                  <span className="pill-icon" aria-hidden="true">
                    <Pill size={17} strokeWidth={ICON_STROKE} />
                  </span>
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
                      <X aria-hidden="true" size={16} strokeWidth={ICON_STROKE} />
                    </button>
                  )}
                </div>
                {familyId && medication.id && (
                  <MedicationSchedules
                    familyId={familyId}
                    relativeId={selected.id}
                    medicationId={medication.id}
                    medicationName={medication.name}
                    readOnly={emergencyMode}
                  />
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

      {/* Emergency mode is meant to be a fast, no-frills read of the
          medication list for a first responder — the time-boxed "Hoje"
          breakdown is the opposite of that, so it's hidden while active. */}
      {familyId && !emergencyMode && (
        <TodayDoses key={selected.id} familyId={familyId} relativeId={selected.id} />
      )}
    </article>
  );
}
