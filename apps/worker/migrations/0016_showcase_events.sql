CREATE TABLE `showcase_ballots` (
	`event_id` text NOT NULL,
	`voter_id` text NOT NULL,
	`entry_id` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`event_id`, `voter_id`),
	FOREIGN KEY (`event_id`) REFERENCES `growth_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`voter_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entry_id`) REFERENCES `showcase_entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `showcase_ballots_entry_idx` ON `showcase_ballots` (`entry_id`);--> statement-breakpoint
CREATE TABLE `showcase_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`showcase_id` text NOT NULL,
	`submitted_by` text NOT NULL,
	`submitted_at` integer NOT NULL,
	`withdrawn_at` integer,
	FOREIGN KEY (`event_id`) REFERENCES `growth_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`showcase_id`) REFERENCES `showcases`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`submitted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `showcase_entries_active_idx` ON `showcase_entries` (`event_id`,`showcase_id`) WHERE withdrawn_at IS NULL;--> statement-breakpoint
CREATE INDEX `showcase_entries_event_idx` ON `showcase_entries` (`event_id`);