CREATE TABLE `adoption_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`adoption_id` text NOT NULL,
	`project_id` text NOT NULL,
	`requester_id` text NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`decided_at` integer,
	`decided_by` text,
	FOREIGN KEY (`adoption_id`) REFERENCES `project_adoptions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requester_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`decided_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `adoption_requests_pending_idx` ON `adoption_requests` (`project_id`,`requester_id`) WHERE status = 'pending';--> statement-breakpoint
CREATE INDEX `adoption_requests_project_idx` ON `adoption_requests` (`project_id`,`status`);--> statement-breakpoint
CREATE TABLE `project_adoptions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`original_owner_id` text,
	`previous_stage` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`opened_at` integer NOT NULL,
	`closed_at` integer,
	`outcome` text,
	`adopted_by` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`original_owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`adopted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_adoptions_open_idx` ON `project_adoptions` (`project_id`) WHERE closed_at IS NULL;--> statement-breakpoint
CREATE INDEX `project_adoptions_project_idx` ON `project_adoptions` (`project_id`);