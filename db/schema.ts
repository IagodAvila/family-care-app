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
export type InvitationRow = typeof invitations.$inferSelect;
export type AuditEventRow = typeof auditEvents.$inferSelect;
