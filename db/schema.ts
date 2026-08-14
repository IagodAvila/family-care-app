import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const familyRoles = ["admin", "caregiver", "viewer"] as const;
export const memberStatuses = ["active", "revoked"] as const;

export type FamilyRole = (typeof familyRoles)[number];
export type MemberStatus = (typeof memberStatuses)[number];

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    authProvider: text("auth_provider").notNull(),
    authSubject: text("auth_subject").notNull(),
    emailNormalized: text("email_normalized").notNull(),
    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),
    status: text("status", { enum: ["active", "blocked", "deleted"] })
      .notNull()
      .default("active"),
    lastLoginAt: integer("last_login_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    deletedAt: integer("deleted_at"),
  },
  (table) => [
    uniqueIndex("users_auth_identity_unique").on(
      table.authProvider,
      table.authSubject,
    ),
    index("users_email_normalized_idx").on(table.emailNormalized),
    index("users_status_updated_at_idx").on(table.status, table.updatedAt),
    check(
      "users_status_check",
      sql`${table.status} in ('active', 'blocked', 'deleted')`,
    ),
  ],
);

export const families = sqliteTable(
  "families",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: text("status", {
      enum: ["active", "pending_deletion", "deleted"],
    })
      .notNull()
      .default("active"),
    version: integer("version").notNull().default(1),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    deletedAt: integer("deleted_at"),
    purgeAfter: integer("purge_after"),
  },
  (table) => [
    index("families_created_by_user_id_idx").on(table.createdByUserId),
    index("families_status_purge_after_idx").on(
      table.status,
      table.purgeAfter,
    ),
    check(
      "families_status_check",
      sql`${table.status} in ('active', 'pending_deletion', 'deleted')`,
    ),
    check("families_version_check", sql`${table.version} >= 1`),
  ],
);

export const familyMembers = sqliteTable(
  "family_members",
  {
    familyId: text("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "restrict" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    role: text("role", { enum: familyRoles }).notNull(),
    status: text("status", { enum: memberStatuses })
      .notNull()
      .default("active"),
    invitedByUserId: text("invited_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    joinedAt: integer("joined_at").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    revokedAt: integer("revoked_at"),
    revokedByUserId: text("revoked_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    primaryKey({
      name: "family_members_family_user_pk",
      columns: [table.familyId, table.userId],
    }),
    index("family_members_user_status_idx").on(table.userId, table.status),
    index("family_members_family_role_status_idx").on(
      table.familyId,
      table.role,
      table.status,
    ),
    check(
      "family_members_role_check",
      sql`${table.role} in ('admin', 'caregiver', 'viewer')`,
    ),
    check(
      "family_members_status_check",
      sql`${table.status} in ('active', 'revoked')`,
    ),
  ],
);

export const relatives = sqliteTable(
  "relatives",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "restrict" }),
    importSourceId: text("import_source_id"),
    name: text("name").notNull(),
    relation: text("relation").notNull(),
    birthDate: text("birth_date").notNull(),
    bloodType: text("blood_type").notNull(),
    conditions: text("conditions_json", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default([]),
    allergies: text("allergies_json", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default([]),
    notes: text("notes").notNull().default(""),
    color: text("color").notNull().default(""),
    photoUrl: text("photo_url"),
    position: integer("position").notNull().default(0),
    version: integer("version").notNull().default(1),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    updatedByUserId: text("updated_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    deletedAt: integer("deleted_at"),
    deletedByUserId: text("deleted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    uniqueIndex("relatives_family_id_id_unique").on(
      table.familyId,
      table.id,
    ),
    uniqueIndex("relatives_family_import_source_unique")
      .on(table.familyId, table.importSourceId)
      .where(sql`${table.importSourceId} is not null`),
    index("relatives_family_deleted_position_idx").on(
      table.familyId,
      table.deletedAt,
      table.position,
    ),
    index("relatives_family_updated_at_idx").on(
      table.familyId,
      table.updatedAt,
    ),
    check("relatives_position_check", sql`${table.position} >= 0`),
    check("relatives_version_check", sql`${table.version} >= 1`),
    check("relatives_conditions_json_check", sql`json_valid(${table.conditions})`),
    check("relatives_allergies_json_check", sql`json_valid(${table.allergies})`),
  ],
);

export const medications = sqliteTable(
  "medications",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id").notNull(),
    relativeId: text("relative_id").notNull(),
    name: text("name").notNull().default(""),
    dosage: text("dosage").notNull().default(""),
    orientation: text("orientation").notNull().default(""),
    frequency: integer("frequency"),
    schedules: text("schedules_json", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default([]),
    legacySchedule: text("legacy_schedule"),
    position: integer("position").notNull().default(0),
    version: integer("version").notNull().default(1),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    updatedByUserId: text("updated_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    deletedAt: integer("deleted_at"),
    deletedByUserId: text("deleted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    uniqueIndex("medications_family_id_id_unique").on(
      table.familyId,
      table.id,
    ),
    foreignKey({
      name: "medications_family_relative_fk",
      columns: [table.familyId, table.relativeId],
      foreignColumns: [relatives.familyId, relatives.id],
    }).onDelete("restrict"),
    index("medications_family_relative_deleted_position_idx").on(
      table.familyId,
      table.relativeId,
      table.deletedAt,
      table.position,
    ),
    index("medications_family_updated_at_idx").on(
      table.familyId,
      table.updatedAt,
    ),
    check("medications_position_check", sql`${table.position} >= 0`),
    check("medications_version_check", sql`${table.version} >= 1`),
    check(
      "medications_frequency_check",
      sql`${table.frequency} is null or ${table.frequency} > 0`,
    ),
    check("medications_schedules_json_check", sql`json_valid(${table.schedules})`),
  ],
);

export const medicationSchedules = sqliteTable(
  "medication_schedules",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id").notNull(),
    medicationId: text("medication_id").notNull(),
    // "HH:MM", 24h clock.
    timeOfDay: text("time_of_day").notNull(),
    // ISO weekday numbers, 1=segunda .. 7=domingo.
    daysOfWeek: text("days_of_week_json", { mode: "json" })
      .$type<number[]>()
      .notNull()
      .default([1, 2, 3, 4, 5, 6, 7]),
    quantity: integer("quantity").notNull().default(1),
    // A dated treatment ("10 dias de amoxicilina") vs. an ongoing/indefinite
    // one (e.g. daily blood pressure medication): all three are null
    // together, or all three set together (see the check below). `endDate`
    // is redundant with `startDate` + `durationDays` but is stored (not
    // computed on read) so the cron sweep and "due today" query can filter
    // on it directly instead of doing date arithmetic per row.
    startDate: text("start_date"),
    durationDays: integer("duration_days"),
    endDate: text("end_date"),
    position: integer("position").notNull().default(0),
    version: integer("version").notNull().default(1),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    updatedByUserId: text("updated_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    deletedAt: integer("deleted_at"),
    deletedByUserId: text("deleted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    uniqueIndex("medication_schedules_family_id_id_unique").on(
      table.familyId,
      table.id,
    ),
    foreignKey({
      name: "medication_schedules_family_medication_fk",
      columns: [table.familyId, table.medicationId],
      foreignColumns: [medications.familyId, medications.id],
    }).onDelete("restrict"),
    index("medication_schedules_family_medication_deleted_position_idx").on(
      table.familyId,
      table.medicationId,
      table.deletedAt,
      table.position,
    ),
    check("medication_schedules_quantity_check", sql`${table.quantity} > 0`),
    check("medication_schedules_position_check", sql`${table.position} >= 0`),
    check("medication_schedules_version_check", sql`${table.version} >= 1`),
    check(
      "medication_schedules_time_of_day_check",
      sql`${table.timeOfDay} glob '[0-2][0-9]:[0-5][0-9]'`,
    ),
    check(
      "medication_schedules_days_of_week_json_check",
      sql`json_valid(${table.daysOfWeek})`,
    ),
    check(
      "medication_schedules_duration_days_check",
      sql`${table.durationDays} is null or ${table.durationDays} > 0`,
    ),
    check(
      "medication_schedules_start_date_check",
      sql`${table.startDate} is null or ${table.startDate} glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'`,
    ),
    check(
      "medication_schedules_end_date_check",
      sql`${table.endDate} is null or ${table.endDate} glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'`,
    ),
    check(
      "medication_schedules_treatment_window_check",
      sql`(${table.startDate} is null and ${table.durationDays} is null and ${table.endDate} is null)
        or (${table.startDate} is not null and ${table.durationDays} is not null and ${table.endDate} is not null)`,
    ),
  ],
);

export const medicationDoses = sqliteTable(
  "medication_doses",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id").notNull(),
    medicationId: text("medication_id").notNull(),
    scheduleId: text("schedule_id").notNull(),
    // "YYYY-MM-DD", the local calendar day (fixed app timezone) this
    // occurrence belongs to — together with scheduleId this is the
    // idempotency key shared by the cron sweep and manual "mark as taken".
    occurrenceDate: text("occurrence_date").notNull(),
    scheduledAt: integer("scheduled_at").notNull(),
    notifiedAt: integer("notified_at"),
    takenAt: integer("taken_at"),
    takenByUserId: text("taken_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("medication_doses_schedule_occurrence_unique").on(
      table.scheduleId,
      table.occurrenceDate,
    ),
    index("medication_doses_family_medication_scheduled_idx").on(
      table.familyId,
      table.medicationId,
      table.scheduledAt,
    ),
    check(
      "medication_doses_occurrence_date_check",
      sql`${table.occurrenceDate} glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'`,
    ),
  ],
);

export const pushSubscriptions = sqliteTable(
  "push_subscriptions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    authKey: text("auth_key").notNull(),
    userAgent: text("user_agent"),
    createdAt: integer("created_at").notNull(),
    lastSeenAt: integer("last_seen_at").notNull(),
    lastFailureAt: integer("last_failure_at"),
    failureCount: integer("failure_count").notNull().default(0),
  },
  (table) => [
    uniqueIndex("push_subscriptions_endpoint_unique").on(table.endpoint),
    index("push_subscriptions_user_idx").on(table.userId),
    check(
      "push_subscriptions_failure_count_check",
      sql`${table.failureCount} >= 0`,
    ),
  ],
);

export const invitations = sqliteTable(
  "invitations",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "restrict" }),
    emailNormalized: text("email_normalized").notNull(),
    role: text("role", { enum: ["caregiver", "viewer"] }).notNull(),
    tokenHash: text("token_hash").notNull(),
    status: text("status", {
      enum: ["pending", "accepted", "expired", "revoked"],
    })
      .notNull()
      .default("pending"),
    invitedByUserId: text("invited_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    acceptedByUserId: text("accepted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    expiresAt: integer("expires_at").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    acceptedAt: integer("accepted_at"),
    revokedAt: integer("revoked_at"),
  },
  (table) => [
    uniqueIndex("invitations_token_hash_unique").on(table.tokenHash),
    uniqueIndex("invitations_pending_family_email_unique")
      .on(table.familyId, table.emailNormalized)
      .where(sql`${table.status} = 'pending'`),
    index("invitations_family_status_expires_idx").on(
      table.familyId,
      table.status,
      table.expiresAt,
    ),
    index("invitations_email_status_idx").on(
      table.emailNormalized,
      table.status,
    ),
    check(
      "invitations_role_check",
      sql`${table.role} in ('caregiver', 'viewer')`,
    ),
    check(
      "invitations_status_check",
      sql`${table.status} in ('pending', 'accepted', 'expired', 'revoked')`,
    ),
  ],
);

export const auditEvents = sqliteTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id").references(() => families.id, {
      onDelete: "set null",
    }),
    actorUserId: text("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    outcome: text("outcome", { enum: ["success", "denied", "failed"] })
      .notNull(),
    requestId: text("request_id"),
    metadata: text("metadata_json", { mode: "json" })
      .$type<Record<string, string | number | boolean | null>>()
      .notNull()
      .default({}),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("audit_events_family_created_at_idx").on(
      table.familyId,
      table.createdAt,
    ),
    index("audit_events_actor_created_at_idx").on(
      table.actorUserId,
      table.createdAt,
    ),
    index("audit_events_action_created_at_idx").on(
      table.action,
      table.createdAt,
    ),
    check(
      "audit_events_outcome_check",
      sql`${table.outcome} in ('success', 'denied', 'failed')`,
    ),
    check("audit_events_metadata_json_check", sql`json_valid(${table.metadata})`),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type FamilyRow = typeof families.$inferSelect;
export type FamilyMemberRow = typeof familyMembers.$inferSelect;
export type RelativeRow = typeof relatives.$inferSelect;
export type MedicationRow = typeof medications.$inferSelect;
export type MedicationScheduleRow = typeof medicationSchedules.$inferSelect;
export type MedicationDoseRow = typeof medicationDoses.$inferSelect;
export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;
export type InvitationRow = typeof invitations.$inferSelect;
export type AuditEventRow = typeof auditEvents.$inferSelect;
