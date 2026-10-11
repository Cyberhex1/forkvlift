CREATE TABLE `subscribers` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`token` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`confirmed_at` integer,
	`unsubscribed_at` integer,
	`last_sent_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscribers_email_unique` ON `subscribers` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `subscribers_token_unique` ON `subscribers` (`token`);