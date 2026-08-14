CREATE TABLE `medication_doses` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`medication_id` text NOT NULL,
	`schedule_id` text NOT NULL,
	`occurrence_date` text NOT NULL,
	`scheduled_at` integer NOT NULL,
	`notified_at` integer,
	`taken_at` integer,
	`taken_by_user_id` text,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`taken_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "medication_doses_occurrence_date_check" CHECK("medication_doses"."occurrence_date" glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `medication_doses_schedule_occurrence_unique` ON `medication_doses` (`schedule_id`,`occurrence_date`);--> statement-breakpoint
CREATE INDEX `medication_doses_family_medication_scheduled_idx` ON `medication_doses` (`family_id`,`medication_id`,`scheduled_at`);--> statement-breakpoint
CREATE TABLE `medication_schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`medication_id` text NOT NULL,
	`time_of_day` text NOT NULL,
	`days_of_week_json` text DEFAULT '[1,2,3,4,5,6,7]' NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
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
	FOREIGN KEY (`family_id`,`medication_id`) REFERENCES `medications`(`family_id`,`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "medication_schedules_quantity_check" CHECK("medication_schedules"."quantity" > 0),
	CONSTRAINT "medication_schedules_position_check" CHECK("medication_schedules"."position" >= 0),
	CONSTRAINT "medication_schedules_version_check" CHECK("medication_schedules"."version" >= 1),
	CONSTRAINT "medication_schedules_time_of_day_check" CHECK("medication_schedules"."time_of_day" glob '[0-2][0-9]:[0-5][0-9]'),
	CONSTRAINT "medication_schedules_days_of_week_json_check" CHECK(json_valid("medication_schedules"."days_of_week_json"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `medication_schedules_family_id_id_unique` ON `medication_schedules` (`family_id`,`id`);--> statement-breakpoint
CREATE INDEX `medication_schedules_family_medication_deleted_position_idx` ON `medication_schedules` (`family_id`,`medication_id`,`deleted_at`,`position`);--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth_key` text NOT NULL,
	`user_agent` text,
	`created_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`last_failure_at` integer,
	`failure_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "push_subscriptions_failure_count_check" CHECK("push_subscriptions"."failure_count" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_subscriptions_endpoint_unique` ON `push_subscriptions` (`endpoint`);--> statement-breakpoint
CREATE INDEX `push_subscriptions_user_idx` ON `push_subscriptions` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `medications_family_id_id_unique` ON `medications` (`family_id`,`id`);