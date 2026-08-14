PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_medication_schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`medication_id` text NOT NULL,
	`time_of_day` text NOT NULL,
	`days_of_week_json` text DEFAULT '[1,2,3,4,5,6,7]' NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`start_date` text,
	`duration_days` integer,
	`end_date` text,
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
	CONSTRAINT "medication_schedules_quantity_check" CHECK("__new_medication_schedules"."quantity" > 0),
	CONSTRAINT "medication_schedules_position_check" CHECK("__new_medication_schedules"."position" >= 0),
	CONSTRAINT "medication_schedules_version_check" CHECK("__new_medication_schedules"."version" >= 1),
	CONSTRAINT "medication_schedules_time_of_day_check" CHECK("__new_medication_schedules"."time_of_day" glob '[0-2][0-9]:[0-5][0-9]'),
	CONSTRAINT "medication_schedules_days_of_week_json_check" CHECK(json_valid("__new_medication_schedules"."days_of_week_json")),
	CONSTRAINT "medication_schedules_duration_days_check" CHECK("__new_medication_schedules"."duration_days" is null or "__new_medication_schedules"."duration_days" > 0),
	CONSTRAINT "medication_schedules_start_date_check" CHECK("__new_medication_schedules"."start_date" is null or "__new_medication_schedules"."start_date" glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "medication_schedules_end_date_check" CHECK("__new_medication_schedules"."end_date" is null or "__new_medication_schedules"."end_date" glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "medication_schedules_treatment_window_check" CHECK(("__new_medication_schedules"."start_date" is null and "__new_medication_schedules"."duration_days" is null and "__new_medication_schedules"."end_date" is null)
        or ("__new_medication_schedules"."start_date" is not null and "__new_medication_schedules"."duration_days" is not null and "__new_medication_schedules"."end_date" is not null))
);
--> statement-breakpoint
INSERT INTO `__new_medication_schedules`("id", "family_id", "medication_id", "time_of_day", "days_of_week_json", "quantity", "start_date", "duration_days", "end_date", "position", "version", "created_by_user_id", "updated_by_user_id", "created_at", "updated_at", "deleted_at", "deleted_by_user_id") SELECT "id", "family_id", "medication_id", "time_of_day", "days_of_week_json", "quantity", NULL, NULL, NULL, "position", "version", "created_by_user_id", "updated_by_user_id", "created_at", "updated_at", "deleted_at", "deleted_by_user_id" FROM `medication_schedules`;--> statement-breakpoint
DROP TABLE `medication_schedules`;--> statement-breakpoint
ALTER TABLE `__new_medication_schedules` RENAME TO `medication_schedules`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `medication_schedules_family_id_id_unique` ON `medication_schedules` (`family_id`,`id`);--> statement-breakpoint
CREATE INDEX `medication_schedules_family_medication_deleted_position_idx` ON `medication_schedules` (`family_id`,`medication_id`,`deleted_at`,`position`);