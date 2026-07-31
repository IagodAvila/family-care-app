CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text,
	`actor_user_id` text,
	`action` text NOT NULL,
	`target_type` text,
	`target_id` text,
	`outcome` text NOT NULL,
	`request_id` text,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "audit_events_outcome_check" CHECK("audit_events"."outcome" in ('success', 'denied', 'failed')),
	CONSTRAINT "audit_events_metadata_json_check" CHECK(json_valid("audit_events"."metadata_json"))
);
--> statement-breakpoint
CREATE INDEX `audit_events_family_created_at_idx` ON `audit_events` (`family_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_events_actor_created_at_idx` ON `audit_events` (`actor_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_events_action_created_at_idx` ON `audit_events` (`action`,`created_at`);--> statement-breakpoint
CREATE TABLE `families` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`purge_after` integer,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "families_status_check" CHECK("families"."status" in ('active', 'pending_deletion', 'deleted')),
	CONSTRAINT "families_version_check" CHECK("families"."version" >= 1)
);
--> statement-breakpoint
CREATE INDEX `families_created_by_user_id_idx` ON `families` (`created_by_user_id`);--> statement-breakpoint
CREATE INDEX `families_status_purge_after_idx` ON `families` (`status`,`purge_after`);--> statement-breakpoint
CREATE TABLE `family_members` (
	`family_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`invited_by_user_id` text,
	`joined_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`revoked_at` integer,
	`revoked_by_user_id` text,
	PRIMARY KEY(`family_id`, `user_id`),
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`invited_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`revoked_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "family_members_role_check" CHECK("family_members"."role" in ('admin', 'caregiver', 'viewer')),
	CONSTRAINT "family_members_status_check" CHECK("family_members"."status" in ('active', 'revoked'))
);
--> statement-breakpoint
CREATE INDEX `family_members_user_status_idx` ON `family_members` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `family_members_family_role_status_idx` ON `family_members` (`family_id`,`role`,`status`);--> statement-breakpoint
CREATE TABLE `invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`email_normalized` text NOT NULL,
	`role` text NOT NULL,
	`token_hash` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`invited_by_user_id` text NOT NULL,
	`accepted_by_user_id` text,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`accepted_at` integer,
	`revoked_at` integer,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`invited_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`accepted_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "invitations_role_check" CHECK("invitations"."role" in ('caregiver', 'viewer')),
	CONSTRAINT "invitations_status_check" CHECK("invitations"."status" in ('pending', 'accepted', 'expired', 'revoked'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invitations_token_hash_unique` ON `invitations` (`token_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `invitations_pending_family_email_unique` ON `invitations` (`family_id`,`email_normalized`) WHERE "invitations"."status" = 'pending';--> statement-breakpoint
CREATE INDEX `invitations_family_status_expires_idx` ON `invitations` (`family_id`,`status`,`expires_at`);--> statement-breakpoint
CREATE INDEX `invitations_email_status_idx` ON `invitations` (`email_normalized`,`status`);--> statement-breakpoint
CREATE TABLE `medications` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`relative_id` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`dosage` text DEFAULT '' NOT NULL,
	`orientation` text DEFAULT '' NOT NULL,
	`frequency` integer,
	`schedules_json` text DEFAULT '[]' NOT NULL,
	`legacy_schedule` text,
	`position` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_by_user_id` text,
	`updated_by_user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`deleted_by_user_id` text,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`deleted_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`family_id`,`relative_id`) REFERENCES `relatives`(`family_id`,`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "medications_position_check" CHECK("medications"."position" >= 0),
	CONSTRAINT "medications_version_check" CHECK("medications"."version" >= 1),
	CONSTRAINT "medications_frequency_check" CHECK("medications"."frequency" is null or "medications"."frequency" > 0),
	CONSTRAINT "medications_schedules_json_check" CHECK(json_valid("medications"."schedules_json"))
);
--> statement-breakpoint
CREATE INDEX `medications_family_relative_deleted_position_idx` ON `medications` (`family_id`,`relative_id`,`deleted_at`,`position`);--> statement-breakpoint
CREATE INDEX `medications_family_updated_at_idx` ON `medications` (`family_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `relatives` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`import_source_id` text,
	`name` text NOT NULL,
	`relation` text NOT NULL,
	`birth_date` text NOT NULL,
	`blood_type` text NOT NULL,
	`conditions_json` text DEFAULT '[]' NOT NULL,
	`allergies_json` text DEFAULT '[]' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`color` text DEFAULT '' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_by_user_id` text,
	`updated_by_user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`deleted_by_user_id` text,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`deleted_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "relatives_position_check" CHECK("relatives"."position" >= 0),
	CONSTRAINT "relatives_version_check" CHECK("relatives"."version" >= 1),
	CONSTRAINT "relatives_conditions_json_check" CHECK(json_valid("relatives"."conditions_json")),
	CONSTRAINT "relatives_allergies_json_check" CHECK(json_valid("relatives"."allergies_json"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `relatives_family_id_id_unique` ON `relatives` (`family_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `relatives_family_import_source_unique` ON `relatives` (`family_id`,`import_source_id`) WHERE "relatives"."import_source_id" is not null;--> statement-breakpoint
CREATE INDEX `relatives_family_deleted_position_idx` ON `relatives` (`family_id`,`deleted_at`,`position`);--> statement-breakpoint
CREATE INDEX `relatives_family_updated_at_idx` ON `relatives` (`family_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`auth_provider` text NOT NULL,
	`auth_subject` text NOT NULL,
	`email_normalized` text NOT NULL,
	`display_name` text,
	`status` text DEFAULT 'active' NOT NULL,
	`last_login_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	CONSTRAINT "users_status_check" CHECK("users"."status" in ('active', 'blocked', 'deleted'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_auth_identity_unique` ON `users` (`auth_provider`,`auth_subject`);--> statement-breakpoint
CREATE INDEX `users_email_normalized_idx` ON `users` (`email_normalized`);--> statement-breakpoint
CREATE INDEX `users_status_updated_at_idx` ON `users` (`status`,`updated_at`);