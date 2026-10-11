CREATE TABLE `showcase_credits` (
	`showcase_id` text NOT NULL,
	`project_id` text,
	`resource_id` text,
	`position` integer NOT NULL,
	FOREIGN KEY (`showcase_id`) REFERENCES `showcases`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resource_id`) REFERENCES `resources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `showcase_credits_showcase_idx` ON `showcase_credits` (`showcase_id`,`position`);--> statement-breakpoint
CREATE INDEX `showcase_credits_project_idx` ON `showcase_credits` (`project_id`);--> statement-breakpoint
CREATE INDEX `showcase_credits_resource_idx` ON `showcase_credits` (`resource_id`);