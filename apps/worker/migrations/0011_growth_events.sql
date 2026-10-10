CREATE TABLE `growth_ballots` (
	`event_id` text NOT NULL,
	`voter_id` text NOT NULL,
	`entry_id` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`event_id`, `voter_id`),
	FOREIGN KEY (`event_id`) REFERENCES `growth_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`voter_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entry_id`) REFERENCES `growth_entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `growth_ballots_entry_idx` ON `growth_ballots` (`entry_id`);--> statement-breakpoint
CREATE TABLE `growth_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`project_id` text NOT NULL,
	`submitted_by` text NOT NULL,
	`submitted_at` integer NOT NULL,
	`withdrawn_at` integer,
	FOREIGN KEY (`event_id`) REFERENCES `growth_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`submitted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `growth_entries_active_idx` ON `growth_entries` (`event_id`,`project_id`) WHERE withdrawn_at IS NULL;--> statement-breakpoint
CREATE INDEX `growth_entries_event_idx` ON `growth_entries` (`event_id`);--> statement-breakpoint
CREATE TABLE `growth_events` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body_md` text DEFAULT '' NOT NULL,
	`featured_project_id` text,
	`starts_at` integer NOT NULL,
	`submission_ends_at` integer NOT NULL,
	`voting_ends_at` integer NOT NULL,
	`cancelled_at` integer,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`featured_project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `growth_events_slug_unique` ON `growth_events` (`slug`);