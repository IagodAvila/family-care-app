"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, Check, Clock } from "lucide-react";
import { api } from "@/lib/api-client";
import {
  DAY_PERIOD_LABELS,
  DAY_PERIODS,
  formatTime,
  getDayPeriod,
  hourFromTime,
} from "@/lib/family-format";
import type { DueDose } from "@/types/family";

const ICON_STROKE = 1.75;
/** Catches a newly-due dose (or one someone else on the family just marked/undid) without a full page reload. */
const POLL_INTERVAL_MS = 60_000;
/** Dispatched by medication-schedules.tsx after adding/removing a horário, so this refreshes right away instead of waiting for the next poll. */
export const SCHEDULES_CHANGED_EVENT = "familycare:schedules-changed";
/** A dose isn't flagged "atrasado" the instant its minute ticks over — only once it's been sitting unmarked for a while. */
const OVERDUE_GRACE_MS = 5 * 60_000;

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
 * With many medications this list could grow huge, so by default it only
 * shows the current stretch of the day (manhã/tarde/noite/madrugada) — a
 * "Dia todo" tab reveals every stretch, grouped. Doses overdue by more
 * than `OVERDUE_GRACE_MS` always surface in their own "Atrasados" group
 * regardless of that toggle, so a reminder never hides just because its
 * period isn't the one currently in view.
 *
 * Refreshes on its own — via polling, on tab/window focus, and on
 * `SCHEDULES_CHANGED_EVENT` — rather than only ever fetching once, so new
 * doses (or changes made elsewhere/by someone else) show up without the
 * user having to reload the page.
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
  const [showFullDay, setShowFullDay] = useState(false);
  // The clock has to be state, not a bare `Date.now()` during render: what
  // counts as overdue (and which period is "Agora") changes as time passes
  // even when nothing else does, and this component would otherwise only
  // re-evaluate that on an unrelated re-render. Ticks on the same interval
  // as the refresh below, so both stay in step.
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    setNow(Date.now());
    try {
      const data = await api(`/api/families/${familyId}/relatives/${relativeId}/doses`);
      setDoses(data.doses);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar os horários de hoje.");
    }
  }, [familyId, relativeId]);

  /* eslint-disable react-hooks/set-state-in-effect -- Loads today's doses from the server once on mount (and re-subscribes the polling/focus/event listeners below), same pattern as members-panel.tsx. */
  useEffect(() => {
    refresh();

    const interval = window.setInterval(refresh, POLL_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);
    window.addEventListener(SCHEDULES_CHANGED_EVENT, refresh);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(SCHEDULES_CHANGED_EVENT, refresh);
    };
  }, [refresh]);
  /* eslint-enable react-hooks/set-state-in-effect */

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

  function renderDose(dose: DueDose, overdue: boolean) {
    return (
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
            className={overdue ? "today-doses-mark today-doses-mark--overdue" : "today-doses-mark"}
            onClick={() => markTaken(dose)}
            disabled={pendingScheduleId === dose.scheduleId}
          >
            {overdue && <Bell aria-hidden="true" size={13} strokeWidth={ICON_STROKE} />}
            {overdue ? "Atrasado — marcar como tomado" : "Marcar como tomado"}
          </button>
        )}
      </li>
    );
  }

  if (!error && (doses === null || doses.length === 0)) {
    return null;
  }

  const allDoses = doses ?? [];
  const overdueDoses = allDoses.filter((dose) => !dose.takenAt && now - dose.scheduledAt > OVERDUE_GRACE_MS);
  const overdueIds = new Set(overdueDoses.map((dose) => dose.scheduleId));
  // Overdue doses get their own always-visible group below, regardless of
  // the Agora/Dia todo tab, so they never hide just because their period
  // isn't the one in view — everything else follows the tab as usual.
  const currentPeriod = getDayPeriod(new Date(now).getHours());
  const periodsToShow = showFullDay ? DAY_PERIODS : [currentPeriod];
  const dosesByPeriod = new Map(DAY_PERIODS.map((period) => [period, [] as DueDose[]]));
  for (const dose of allDoses) {
    if (overdueIds.has(dose.scheduleId)) continue;
    dosesByPeriod.get(getDayPeriod(hourFromTime(dose.timeOfDay)))?.push(dose);
  }

  return (
    <section className="today-doses">
      <div className="section-heading">
        <h3>Hoje</h3>
        <div className="today-doses-tabs" role="tablist" aria-label="Período do dia">
          <button
            type="button"
            role="tab"
            aria-selected={!showFullDay}
            className={showFullDay ? undefined : "active"}
            onClick={() => setShowFullDay(false)}
          >
            Agora
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={showFullDay}
            className={showFullDay ? "active" : undefined}
            onClick={() => setShowFullDay(true)}
          >
            Dia todo
          </button>
        </div>
      </div>

      {error && <p className="today-doses-error">{error}</p>}

      {overdueDoses.length > 0 && (
        <div className="today-doses-period">
          <p className="today-doses-period-heading today-doses-period-heading--overdue">
            <Bell aria-hidden="true" size={13} strokeWidth={ICON_STROKE} />
            Atrasados
          </p>
          <ul className="today-doses-list">{overdueDoses.map((dose) => renderDose(dose, true))}</ul>
        </div>
      )}

      {periodsToShow.map((period) => {
        const periodDoses = dosesByPeriod.get(period) ?? [];
        return (
          <div key={period} className="today-doses-period">
            <p className="today-doses-period-heading">{DAY_PERIOD_LABELS[period]}</p>
            {periodDoses.length === 0 ? (
              <p className="today-doses-empty-period">
                Nada previsto para {DAY_PERIOD_LABELS[period].toLowerCase()}.
              </p>
            ) : (
              <ul className="today-doses-list">{periodDoses.map((dose) => renderDose(dose, false))}</ul>
            )}
          </div>
        );
      })}
    </section>
  );
}
