CREATE TABLE `daily` (
	`code` text NOT NULL,
	`day` text NOT NULL,
	`clicks` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`code`, `day`),
	FOREIGN KEY (`code`) REFERENCES `links`(`code`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`until` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `links` (
	`code` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer,
	`active` integer DEFAULT 1 NOT NULL,
	`clicks` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `links_owner` ON `links` (`owner`);