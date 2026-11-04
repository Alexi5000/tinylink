ALTER TABLE `links` ADD `generation` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `links` SET `generation` = lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-8' || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)));--> statement-breakpoint
CREATE UNIQUE INDEX `links_generation` ON `links` (`generation`);--> statement-breakpoint
CREATE TRIGGER `links_legacy_generation` AFTER INSERT ON `links`
WHEN NEW.`generation` = ''
BEGIN
  UPDATE `links` SET `generation` = lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-8' || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) WHERE `code` = NEW.`code`;
END;
