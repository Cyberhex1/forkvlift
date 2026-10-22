CREATE TABLE `github_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`etag` text,
	`status` integer NOT NULL,
	`body` text NOT NULL,
	`link` text,
	`fetched_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `github_cache_fetched` ON `github_cache` (`fetched_at`);