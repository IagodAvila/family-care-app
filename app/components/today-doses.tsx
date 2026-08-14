"use client";

import { useEffect, useState } from "react";
import { Check, Clock } from "lucide-react";
import { api } from "@/lib/api-client";
import { formatTime } from "@/lib/family-format";
import type { DueDose } from "@/types/family";

const ICON_STROKE = 1.75;

type TodayDosesProps = {
  familyId: string;
  relativeId: string;
};

/**
 * "Hoje" section: today's schedule occurrences for the selected relative
 * (in the app's fixed timezone, see db/time.ts), with a "Marcar como
 * tomado" action per occurrence. Renders nothing once loaded if there's
 * nothing due today, rather than an empty section taking up space.
 *
 * The caller passes `key={relativeId}` (see medical-record.tsx) so this
 * remounts on relative change instead of resetting `doses`/`error` inside
 * the effect — a fresh instance already starts at their `null` initial
 * state, which keeps the effect itself free of synchronous `setState`
 * calls outside its `.then()`/`.catch()`.
 */
export function TodayDoses({ familyId, relativeId }: TodayDosesProps) {
  const [doses, setDoses] = useState<DueDose[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingScheduleId, setPendingScheduleId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api(`/api/families/${familyId}/relatives/${relativeId}/doses`)
      .then((data) => {
        if (!cancelled) setDoses(data.doses);
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Não foi possível carregar os horários de hoje.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [familyId, relativeId]);

  async function markTaken(dose: DueDose) {
    setPendingScheduleId(dose.scheduleId);
    setError(null);
    try {
      await api(
        `/api/families/${familyId}/relatives/${relativeId}/medications/${dose.medicationId}/schedules/${dose.scheduleId}/doses`,
        { method: "POST", body: JSON.stringify({ occurrenceDate: dose.occurrenceDate }) },
      );
      // The server assigns the real `takenAt` (its own clock, see
      // `FamilyCareDataService.logDoseTaken`'s `input.takenAt ?? this.now()`
      // fallback) — this just needs a truthy value to flip the UI to
      // "Tomado" until the next real fetch, so the scheduled time stands in.
      setDoses((current) =>
        (current ?? []).map((item) =>
          item.scheduleId === dose.scheduleId ? { ...item, takenAt: item.scheduledAt } : item,
        ),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível registrar a dose.");
    } finally {
      setPendingScheduleId(null);
    }
  }

  /** Undoes a dose marked by mistake — clears `takenAt` without touching the notification record (see `undoDoseTaken`). */
  async function undoTaken(dose: DueDose) {
    setPendingScheduleId(dose.scheduleId);
    setError(null);
    try {
      await api(
        `/api/families/${familyId}/relatives/${relativeId}/medications/${dose.medicationId}/schedules/${dose.scheduleId}/doses?occurrenceDate=${dose.occurrenceDate}`,
        { method: "DELETE" },
      );
      setDoses((current) =>
        (current ?? []).map((item) => (item.scheduleId === dose.scheduleId ? { ...item, takenAt: null } : item)),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível desfazer a marcação.");
    } finally {
      setPendingScheduleId(null);
    }
  }

  if (!error && (doses === null || doses.length === 0)) {
    return null;
  }

  return (
    <section className="today-doses">
      <div className="section-heading">
        <h3>Hoje</h3>
      </div>
      {error && <p className="today-doses-error">{error}</p>}
      {doses && doses.length > 0 && (
        <ul className="today-doses-list">
          {doses.map((dose) => (
            <li key={dose.scheduleId} className={dose.takenAt ? "taken" : undefined}>
              <span className="today-doses-time" aria-hidden="true">
                <Clock size={14} strokeWidth={ICON_STROKE} />
                {formatTime(dose.timeOfDay)}
              </span>
              <div>
                <strong>{dose.medicationName}</strong>
                <small>{dose.dosage ? `${dose.dosage} · ${dose.quantity}x` : `${dose.quantity}x`}</small>
              </div>
              {dose.takenAt ? (
                <div className="today-doses-done-group">
                  <span className="today-doses-done">
                    <Check aria-hidden="true" size={14} strokeWidth={ICON_STROKE} />
                    Tomado
                  </span>
                  <button
                    type="button"
                    className="today-doses-undo"
                    onClick={() => undoTaken(dose)}
                    disabled={pendingScheduleId === dose.scheduleId}
                  >
                    Desmarcar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="today-doses-mark"
                  onClick={() => markTaken(dose)}
                  disabled={pendingScheduleId === dose.scheduleId}
                >
                  Marcar como tomado
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
