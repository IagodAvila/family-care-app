import type { AnyD1Database } from "drizzle-orm/d1";
// Relative (not "@/") imports here: this module is reachable from
// `worker/index.ts`'s `scheduled` handler, which sits outside the
// vinext-bundled app router and can't rely on the "@/" path alias resolving.
import { createDb } from "../../db/index.ts";
import {
  deleteExpiredSubscription,
  findDueSchedules,
  listActivePushSubscriptionsForFamily,
  recordNotifiedOccurrence,
  type ReminderSubscription,
} from "../../db/queries/reminders.ts";
import { sendWebPush } from "./send.ts";

type ReminderSweepEnv = {
  DB: AnyD1Database;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
};

export type ReminderSweepResult = { due: number; sent: number; skipped: number };

/**
 * Runs one pass of the medication-reminder Cron Trigger: finds schedule
 * occurrences due in the trailing window, claims each one exactly once
 * (`recordNotifiedOccurrence`'s idempotency check), and pushes a
 * notification to every active member of the relevant family. No-ops
 * cleanly if VAPID keys aren't configured — this feature is optional,
 * matching the `AI` binding precedent in `lib/auth/env.ts`.
 */
export async function runReminderSweep(env: ReminderSweepEnv): Promise<ReminderSweepResult> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    return { due: 0, sent: 0, skipped: 0 };
  }
  const vapid = {
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
    subject: env.VAPID_SUBJECT,
  };

  const db = createDb(env.DB);
  const now = Date.now();
  const dueSchedules = await findDueSchedules(db, now);

  let sent = 0;
  let skipped = 0;
  // Cache each family's subscriptions for the duration of this sweep —
  // several schedules due in the same run commonly belong to the same family.
  const subscriptionsByFamily = new Map<string, ReminderSubscription[]>();

  for (const due of dueSchedules) {
    const claimed = await recordNotifiedOccurrence(db, {
      id: crypto.randomUUID(),
      familyId: due.familyId,
      medicationId: due.medicationId,
      scheduleId: due.scheduleId,
      occurrenceDate: due.occurrenceDate,
      scheduledAt: due.scheduledAt,
      now,
    });
    if (!claimed) {
      // Already notified this run (overlapping window), or already logged
      // as taken before the cron got to it — either way, one push per
      // occurrence, no re-nagging.
      skipped++;
      continue;
    }

    let subscriptions = subscriptionsByFamily.get(due.familyId);
    if (!subscriptions) {
      subscriptions = await listActivePushSubscriptionsForFamily(db, due.familyId);
      subscriptionsByFamily.set(due.familyId, subscriptions);
    }

    const payload = {
      title: "Hora do medicamento",
      body: `${due.relativeName}: ${due.medicationName}`,
      url: `/?relative=${due.relativeId}`,
    };

    for (const subscription of subscriptions) {
      const result = await sendWebPush(subscription, payload, vapid);
      if (result.ok) {
        sent++;
      } else if (result.expired) {
        await deleteExpiredSubscription(db, subscription.id);
      }
    }
  }

  return { due: dueSchedules.length, sent, skipped };
}
