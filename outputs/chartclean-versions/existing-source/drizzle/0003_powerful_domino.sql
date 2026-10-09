CREATE TABLE `hr_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`source_id` text NOT NULL,
	`person` text NOT NULL,
	`data` text NOT NULL,
	`history` text DEFAULT '[]' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hr_entries_kind_source` ON `hr_entries` (`kind`,`source_id`);--> statement-breakpoint
CREATE INDEX `hr_entries_kind_person` ON `hr_entries` (`kind`,`person`);