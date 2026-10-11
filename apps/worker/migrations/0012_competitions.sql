CREATE TABLE `competition_awards` (
	`id` text PRIMARY KEY NOT NULL,
	`round_id` text NOT NULL,
	`prize_id` text NOT NULL,
	`entry_id` text NOT NULL,
	`rationale_md` text DEFAULT '' NOT NULL,
	`announced_at` integer NOT NULL,
	FOREIGN KEY (`round_id`) REFERENCES `competition_rounds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`prize_id`) REFERENCES `competition_prizes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entry_id`) REFERENCES `growth_entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `competition_awards_prize_idx` ON `competition_awards` (`prize_id`);--> statement-breakpoint
CREATE TABLE `competition_criteria` (
	`id` text PRIMARY KEY NOT NULL,
	`round_id` text NOT NULL,
	`label` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`max_score` integer NOT NULL,
	`weight` real DEFAULT 1 NOT NULL,
	FOREIGN KEY (`round_id`) REFERENCES `competition_rounds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `competition_judges` (
	`round_id` text NOT NULL,
	`judge_id` text NOT NULL,
	`conflict_note` text DEFAULT '' NOT NULL,
	PRIMARY KEY(`round_id`, `judge_id`),
	FOREIGN KEY (`round_id`) REFERENCES `competition_rounds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`judge_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `competition_prizes` (
	`id` text PRIMARY KEY NOT NULL,
	`round_id` text NOT NULL,
	`label` text NOT NULL,
	`description_md` text DEFAULT '' NOT NULL,
	`sponsor_name` text,
	`sponsor_url` text,
	`place` integer,
	FOREIGN KEY (`round_id`) REFERENCES `competition_rounds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `competition_rounds` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`rules_md` text DEFAULT '' NOT NULL,
	`eligibility_md` text DEFAULT '' NOT NULL,
	`judging_ends_at` integer NOT NULL,
	`opened_at` integer,
	`published_at` integer,
	`cancelled_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `growth_events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `competition_rounds_event_id_unique` ON `competition_rounds` (`event_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `competition_rounds_slug_unique` ON `competition_rounds` (`slug`);--> statement-breakpoint
CREATE TABLE `competition_scorecards` (
	`round_id` text NOT NULL,
	`entry_id` text NOT NULL,
	`judge_id` text NOT NULL,
	`scores` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`submitted_at` integer,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`round_id`, `entry_id`, `judge_id`),
	FOREIGN KEY (`round_id`) REFERENCES `competition_rounds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entry_id`) REFERENCES `growth_entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`judge_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
