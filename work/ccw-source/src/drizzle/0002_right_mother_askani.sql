CREATE TABLE `control_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`person` text NOT NULL,
	`org` text NOT NULL,
	`data` text NOT NULL,
	`history` text DEFAULT '[]' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`dedup` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `control_entries_dedup_unique` ON `control_entries` (`dedup`);--> statement-breakpoint
CREATE INDEX `control_kind_person` ON `control_entries` (`kind`,`person`);