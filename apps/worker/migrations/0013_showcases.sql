CREATE TABLE `showcase_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`showcase_id` text NOT NULL,
	`author_id` text NOT NULL,
	`parent_id` text,
	`body` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`edited_at` integer,
	`deleted_at` integer,
	FOREIGN KEY (`showcase_id`) REFERENCES `showcases`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `showcase_comments_idx` ON `showcase_comments` (`showcase_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `showcase_links` (
	`id` text PRIMARY KEY NOT NULL,
	`showcase_id` text NOT NULL,
	`kind` text NOT NULL,
	`label` text NOT NULL,
	`url` text NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`showcase_id`) REFERENCES `showcases`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `showcase_links_idx` ON `showcase_links` (`showcase_id`,`position`);--> statement-breakpoint
CREATE TABLE `showcase_media` (
	`id` text PRIMARY KEY NOT NULL,
	`showcase_id` text NOT NULL,
	`kind` text NOT NULL,
	`key` text,
	`embed_url` text,
	`alt` text DEFAULT '' NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`showcase_id`) REFERENCES `showcases`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `showcase_media_idx` ON `showcase_media` (`showcase_id`,`position`);--> statement-breakpoint
CREATE TABLE `showcase_saves` (
	`showcase_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`showcase_id`, `user_id`),
	FOREIGN KEY (`showcase_id`) REFERENCES `showcases`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `showcase_saves_user_idx` ON `showcase_saves` (`user_id`);--> statement-breakpoint
CREATE TABLE `showcase_votes` (
	`showcase_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`showcase_id`, `user_id`),
	FOREIGN KEY (`showcase_id`) REFERENCES `showcases`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `showcases` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`tagline` text DEFAULT '' NOT NULL,
	`body_md` text DEFAULT '' NOT NULL,
	`build_story_md` text DEFAULT '' NOT NULL,
	`category_slug` text NOT NULL,
	`kind` text NOT NULL,
	`stage` text DEFAULT 'finished' NOT NULL,
	`cover_key` text,
	`repo_url` text,
	`catalog_project_id` text,
	`ai_tools` text,
	`build_time` text,
	`tags` text,
	`upvotes` integer DEFAULT 0 NOT NULL,
	`comment_count` integer DEFAULT 0 NOT NULL,
	`staff_pick` integer DEFAULT 0 NOT NULL,
	`published_at` integer,
	`hidden_at` integer,
	`deleted_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_slug`) REFERENCES `categories`(`slug`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`catalog_project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `showcases_slug_unique` ON `showcases` (`slug`);--> statement-breakpoint
CREATE INDEX `showcases_owner_idx` ON `showcases` (`owner_id`);--> statement-breakpoint
CREATE INDEX `showcases_published_idx` ON `showcases` (`published_at`);