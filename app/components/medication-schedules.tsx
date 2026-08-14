"use client";

import { useEffect, useState } from "react";
import { CalendarDays, ChevronDown, Clock, Plus, X } from "lucide-react";
import { api } from "@/lib/api-client";
import { addDaysToDate } from "@/lib/family-data";
import { formatDate, formatTime, WEEKDAY_LABELS } from "@/lib/family-format";
import type { MedicationSchedule } from "@/types/family";

const ALL_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];
const ICON_STROKE = 1.75;

type DraftSchedule = {
  timeOfDay: string;
  daysOfWeek: number[];
  quantity: number;
  treatmentEnabled: boolean;
  startDate: string;
  durationDays: number;
};

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function createEmptyDraft(): DraftSchedule {
  return {
    timeOfDay: "08:00",
    daysOfWeek: ALL_WEEKDAYS,
    quantity: 1,
    treatmentEnabled: false,
    startDate: todayIsoDate(),
    durationDays: 10,
  };
}

type MedicationSchedulesProps = {
  familyId: string;
  relativeId: string;
  medicationId: string;
  medicationName: string;
  readOnly: boolean;
};

/**
 * Collapsible "Horários" panel for a single (already persisted) medication.
 * Schedules can only be attached to a real `medicationId` (the DB FK
 * requires one), so this lives on the read/detail side rather than the
 * relative-form's in-memory medication drafts, which don't have a server id
 * until the relative itself is saved.
 */
export function MedicationSchedules({
  familyId,
  relativeId,
  medicationId,
  medicationName,
  readOnly,
}: MedicationSchedulesProps) {
  const [open, setOpen] = useState(false);
  const [schedules, setSchedules] = useState<MedicationSchedule[] | null>(null);
  const [draft, setDraft] = useState<DraftSchedule>(createEmptyDraft);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const basePath = `/api/families/${familyId}/relatives/${relativeId}/medications/${medicationId}/schedules`;

  // Fetched on mount (not gated by `open`) so the compact summary below the
  // toggle button — the horários and treatment deadline, at a glance — is
  // visible even with the full panel collapsed.
  useEffect(() => {
    let cancelled = false;
    api(basePath)
      .then((data) => {
        if (!cancelled) setSchedules(data.schedules);
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Não foi possível carregar os horários.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [basePath]);

  function toggleDay(day: number) {
    setDraft((current) => ({
      ...current,
      daysOfWeek: current.daysOfWeek.includes(day)
        ? current.daysOfWeek.filter((item) => item !== day)
        : [...current.daysOfWeek, day].sort((a, b) => a - b),
    }));
  }

  async function addSchedule(event: React.FormEvent) {
    event.preventDefault();
    if (draft.daysOfWeek.length === 0) {
      setError("Selecione ao menos um dia da semana.");
      return;
    }
    if (draft.treatmentEnabled && !draft.startDate) {
      setError("Informe a data de início do tratamento.");
      return;
    }
    if (!Number.isSafeInteger(draft.quantity) || draft.quantity < 1) {
      setError("Informe uma quantidade válida.");
      return;
    }
    if (draft.treatmentEnabled && (!Number.isSafeInteger(draft.durationDays) || draft.durationDays < 1)) {
      setError("Informe uma duração válida, em dias.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = {
        timeOfDay: draft.timeOfDay,
        daysOfWeek: draft.daysOfWeek,
        quantity: draft.quantity,
        ...(draft.treatmentEnabled
          ? { startDate: draft.startDate, durationDays: draft.durationDays }
          : {}),
      };
      const created = await api(basePath, { method: "POST", body: JSON.stringify(payload) });
      setSchedules((current) => [...(current ?? []), created.schedule]);
      setDraft(createEmptyDraft());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível salvar o horário.");
    } finally {
      setBusy(false);
    }
  }

  async function removeSchedule(schedule: MedicationSchedule) {
    setBusy(true);
    setError(null);
    try {
      await api(`${basePath}/${schedule.id}?expectedVersion=${schedule.version}`, { method: "DELETE" });
      setSchedules((current) => (current ?? []).filter((item) => item.id !== schedule.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível remover o horário.");
    } finally {
      setBusy(false);
    }
  }

  const today = todayIsoDate();

  return (
    <div className="medication-schedules">
      <div className="medication-schedules-toggle-row">
        {/* Plain label, not a button — only the arrow expands the panel below.
            A switch would wrongly imply "the schedules are only active while
            this is on"; an accordion arrow doesn't carry that on/off meaning. */}
        <span className="medication-schedules-label">
          <Clock aria-hidden="true" size={13} strokeWidth={ICON_STROKE} />
          Horários
        </span>
        <button
          type="button"
          className="medication-schedules-expand"
          aria-expanded={open}
          aria-label={open ? "Ocultar horários" : "Mostrar horários"}
          onClick={() => setOpen((current) => !current)}
        >
          <ChevronDown aria-hidden="true" size={15} strokeWidth={ICON_STROKE} />
        </button>
      </div>

      {!open && schedules && schedules.length > 0 && (
        <ul className="medication-schedules-summary">
          {schedules.map((schedule) => {
            const ended = Boolean(schedule.endDate && schedule.endDate < today);
            return (
              <li key={schedule.id} className={ended ? "ended" : undefined}>
                {formatTime(schedule.timeOfDay)}
                {schedule.endDate && (
                  <span className="medication-schedules-summary-deadline">
                    {ended ? "encerrado" : `até ${formatDate(schedule.endDate)}`}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {open && (
        <div className="medication-schedules-panel">
          {error && <p className="medication-schedules-error">{error}</p>}

          {schedules === null ? (
            <p className="medication-schedules-loading">Carregando horários…</p>
          ) : schedules.length === 0 ? (
            <p className="medication-schedules-empty">Nenhum horário cadastrado.</p>
          ) : (
            <ul className="medication-schedules-list">
              {schedules.map((schedule) => {
                const ended = Boolean(schedule.endDate && schedule.endDate < today);
                return (
                  <li key={schedule.id}>
                    <span className="medication-schedules-time">{formatTime(schedule.timeOfDay)}</span>
                    <span className="medication-schedules-days">
                      {schedule.daysOfWeek.length === 7
                        ? "Todos os dias"
                        : schedule.daysOfWeek.map((day) => WEEKDAY_LABELS[day]).join(", ")}
                      {schedule.startDate && schedule.endDate && (
                        <small className="medication-schedules-treatment-range">
                          {formatDate(schedule.startDate)} – {formatDate(schedule.endDate)}
                          {ended && <span className="medication-schedules-ended">Encerrado</span>}
                        </small>
                      )}
                    </span>
                    <span className="medication-schedules-quantity">{schedule.quantity}x</span>
                    {!readOnly && (
                      <button
                        type="button"
                        aria-label={`Remover horário das ${formatTime(schedule.timeOfDay)}`}
                        disabled={busy}
                        onClick={() => removeSchedule(schedule)}
                      >
                        <X aria-hidden="true" size={13} strokeWidth={ICON_STROKE} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {!readOnly && (
            <form className="medication-schedules-form" onSubmit={addSchedule}>
              <input
                type="time"
                value={draft.timeOfDay}
                onChange={(event) => setDraft((current) => ({ ...current, timeOfDay: event.target.value }))}
                aria-label={`Horário para ${medicationName}`}
                required
              />
              <input
                type="number"
                min={1}
                max={100}
                // Deliberately not `Number(value) || 1`: that fallback fires
                // on every keystroke, including the momentarily-empty value
                // while clearing the field to type a new number, which
                // fights the user by snapping back to 1 before they can
                // finish typing. `valueAsNumber` is NaN for "" or invalid
                // input — a controlled number input renders NaN as empty,
                // so the field can be cleared normally; validity is
                // enforced on submit instead (see `addSchedule`).
                value={Number.isNaN(draft.quantity) ? "" : draft.quantity}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, quantity: event.target.valueAsNumber }))
                }
                aria-label={`Quantidade para ${medicationName}`}
              />
              <div className="medication-schedules-weekdays" role="group" aria-label="Dias da semana">
                {ALL_WEEKDAYS.map((day) => (
                  <button
                    key={day}
                    type="button"
                    className={draft.daysOfWeek.includes(day) ? "active" : undefined}
                    onClick={() => toggleDay(day)}
                    aria-pressed={draft.daysOfWeek.includes(day)}
                  >
                    {WEEKDAY_LABELS[day]}
                  </button>
                ))}
              </div>

              {draft.treatmentEnabled ? (
                <div className="medication-schedules-treatment">
                  <label>
                    Início
                    <input
                      type="date"
                      value={draft.startDate}
                      onChange={(event) => setDraft((current) => ({ ...current, startDate: event.target.value }))}
                      aria-label={`Início do tratamento com ${medicationName}`}
                      required
                    />
                  </label>
                  <label>
                    Duração
                    <span className="medication-schedules-treatment-days">
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={Number.isNaN(draft.durationDays) ? "" : draft.durationDays}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, durationDays: event.target.valueAsNumber }))
                        }
                        aria-label="Duração do tratamento, em dias"
                      />
                      dias
                    </span>
                  </label>
                  {draft.startDate && Number.isSafeInteger(draft.durationDays) && draft.durationDays > 0 && (
                    <span className="medication-schedules-treatment-end">
                      Termina em {formatDate(addDaysToDate(draft.startDate, draft.durationDays - 1))}
                    </span>
                  )}
                  <button
                    type="button"
                    className="medication-schedules-treatment-remove"
                    onClick={() => setDraft((current) => ({ ...current, treatmentEnabled: false }))}
                  >
                    Remover duração
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="medication-schedules-treatment-link"
                  onClick={() => setDraft((current) => ({ ...current, treatmentEnabled: true }))}
                >
                  <CalendarDays aria-hidden="true" size={12} strokeWidth={ICON_STROKE} />
                  Definir duração do tratamento
                </button>
              )}

              <button type="submit" className="medication-schedules-add" disabled={busy}>
                <Plus aria-hidden="true" size={14} strokeWidth={ICON_STROKE} />
                Adicionar horário
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
