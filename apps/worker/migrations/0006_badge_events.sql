CREATE TABLE `badge_events` (
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`ref` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`user_id`, `kind`, `ref`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
