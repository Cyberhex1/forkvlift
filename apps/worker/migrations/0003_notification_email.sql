ALTER TABLE `notifications` ADD `emailed_at` integer;--> statement-breakpoint
CREATE INDEX `notifications_email_pending` ON `notifications` (`emailed_at`,`created_at`);--> statement-breakpoint
ALTER TABLE `users` ADD `digest_sent_at` integer;--> statement-breakpoint
-- Notifications that existed before email delivery are never emailed retroactively.
UPDATE `notifications` SET `emailed_at` = `created_at` WHERE `emailed_at` IS NULL;
