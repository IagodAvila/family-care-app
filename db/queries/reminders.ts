/**
 * "System" query path for the medication-reminder Cron Trigger
 * (`worker/index.ts`'s `scheduled` handler). A cron invocation has no
 * request/session, so it can't build an `AuthorizedFamilyContext` the way
 * every `FamilyCareDataService` method requires — these functions
 * deliberately bypass `requireFamilyRole` (`db/authorization.ts`) and query
 * across every family directly, the same way `db/authorization.ts` itself
 * sits outside the service class. Nothing here should be reachable from a
 * request handler.
 */
import { and, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import type { FamilyCareDatabase } from "../index.ts";
import {
  familyMembers,
  medicationDoses,
  medications,
  medicationSchedules,
  pushSubscriptions,
  relatives,
  users,
} from "../schema.ts";
import { APP_TIMEZONE, currentOccurrenceDate, currentWeekday, scheduledInstant } from "../time.ts";

/** Matches the Cron Trigger interval in `wrangler.jsonc` (every 5 minutes). */
const CRON_WINDOW_MINUTES = 5;

export type DueSchedule = {
  scheduleId: string;
  familyId: string;
  medicationId: string;
  medicationName: string;
  quantity: number;
  relativeId: string;
  relativeName: string;
  occurrenceDate: string;
  scheduledAt: number;
};

function candidateTimesOfDay(now: number): string[] {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIMEZONE,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  });
  const times: string[] = [];
  for (let minutesAgo = 0; minutesAgo < CRON_WINDOW_MINUTES; minutesAgo++) {
    times.push(formatter.format(now - minutesAgo * 60_000));
  }
  return times;
}

/**
 * Schedules due in the trailing `CRON_WINDOW_MINUTES` window (covers the
 * gap between cron runs without needing a persisted "last run" cursor).
 * Whether a given schedule was already notified for today is decided by
 * the caller via `recordNotifiedOccurrence`'s idempotency check, not here.
 */
export async function findDueSchedules(
  db: FamilyCareDatabase,
  now: number = Date.now(),
): Promise<DueSchedule[]> {
  const times = candidateTimesOfDay(now);
  const weekday = currentWeekday(now);
  const occurrenceDate = currentOccurrenceDate(now);

  const rows = await db
    .select({
      scheduleId: medicationSchedules.id,
      familyId: medicationSchedules.familyId,
      medicationId: medicationSchedules.medicationId,
      timeOfDay: medicationSchedules.timeOfDay,
      daysOfWeek: medicationSchedules.daysOfWeek,
      quantity: medicationSchedules.quantity,
      medicationName: medications.name,
      relativeId: relatives.id,
      relativeName: relatives.name,
    })
    .from(medicationSchedules)
    .innerJoin(
      medications,
      and(
        eq(medications.familyId, medicationSchedules.familyId),
        eq(medications.id, medicationSchedules.medicationId),
        isNull(medications.deletedAt),
      ),
    )
    .innerJoin(
      relatives,
      and(
        eq(relatives.familyId, medications.familyId),
        eq(relatives.id, medications.relativeId),
        isNull(relatives.deletedAt),
      ),
    )
    .where(
      and(
        inArray(medicationSchedules.timeOfDay, times),
        isNull(medicationSchedules.deletedAt),
        // Ongoing schedules (no startDate) are always in range; dated
        // treatments only match while occurrenceDate falls within them.
        or(
          isNull(medicationSchedules.startDate),
          and(
            lte(medicationSchedules.startDate, occurrenceDate),
            gte(medicationSchedules.endDate, occurrenceDate),
          ),
        ),
      ),
    )
    .all();

  return rows
    .filter((row) => row.daysOfWeek.includes(weekday))
    .map((row) => ({
      scheduleId: row.scheduleId,
      familyId: row.familyId,
      medicationId: row.medicationId,
      medicationName: row.medicationName,
      quantity: row.quantity,
      relativeId: row.relativeId,
      relativeName: row.relativeName,
      occurrenceDate,
      scheduledAt: scheduledInstant(occurrenceDate, row.timeOfDay),
    }));
}

/**
 * Claims a `(scheduleId, occurrenceDate)` slot for notification. Returns
 * `true` only if this call actually inserted the row — the single source
 * of truth for "should a push go out", shared with the manual "mark as
 * taken" path in `FamilyCareDataService.logDoseTaken`: if a caregiver
 * already logged the dose before the cron ran, this no-ops and no
 * redundant push is sent (matches the product decision: one notification
 * per occurrence, no re-nagging).
 */
export async function recordNotifiedOccurrence(
  db: FamilyCareDatabase,
  params: {
    id: string;
    familyId: string;
    medicationId: string;
    scheduleId: string;
    occurrenceDate: string;
    scheduledAt: number;
    now: number;
  },
): Promise<boolean> {
  const result = await db
    .insert(medicationDoses)
    .values({
      id: params.id,
      familyId: params.familyId,
      medicationId: params.medicationId,
      scheduleId: params.scheduleId,
      occurrenceDate: params.occurrenceDate,
      scheduledAt: params.scheduledAt,
      notifiedAt: params.now,
      createdAt: params.now,
      updatedAt: params.now,
    })
    .onConflictDoNothing({
      target: [medicationDoses.scheduleId, medicationDoses.occurrenceDate],
    });
  return result.meta.changes > 0;
}

export type ReminderSubscription = {
  id: string;
  endpoint: string;
  p256dh: string;
  authKey: string;
};

/** Every active family member's active push subscriptions, for fan-out. */
export async function listActivePushSubscriptionsForFamily(
  db: FamilyCareDatabase,
  familyId: string,
): Promise<ReminderSubscription[]> {
  return db
    .select({
      id: pushSubscriptions.id,
      endpoint: pushSubscriptions.endpoint,
      p256dh: pushSubscriptions.p256dh,
      authKey: pushSubscriptions.authKey,
    })
    .from(pushSubscriptions)
    .innerJoin(
      familyMembers,
      and(
        eq(familyMembers.userId, pushSubscriptions.userId),
        eq(familyMembers.familyId, familyId),
        eq(familyMembers.status, "active"),
      ),
    )
    .innerJoin(users, and(eq(users.id, familyMembers.userId), eq(users.status, "active")))
    .all();
}

/** Cleans up a subscription the push service reported as gone (404/410). */
export async function deleteExpiredSubscription(db: FamilyCareDatabase, id: string) {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, id));
}
