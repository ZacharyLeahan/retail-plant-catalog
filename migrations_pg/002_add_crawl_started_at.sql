-- Add CrawlStartedAt field to track when a crawl is in progress
ALTER TABLE vendor ADD COLUMN IF NOT EXISTS "CrawlStartedAt" TIMESTAMP;


