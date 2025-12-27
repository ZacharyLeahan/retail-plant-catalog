-- Ensure vendor URL entries are not duplicated.
-- This fixes issues where a single "Add URL" action (double-click, retry, or concurrent requests)
-- can create multiple identical rows.

-- 1) Remove exact duplicates, keeping the "best" row (most recently succeeded/failed if available).
WITH ranked AS (
  SELECT
    ctid,
    "VendorId",
    "Uri",
    row_number() OVER (
      PARTITION BY "VendorId", "Uri"
      ORDER BY COALESCE("LastSucceeded", "LastFailed") DESC NULLS LAST, "Id" ASC NULLS LAST
    ) AS rn
  FROM vendor_urls
)
DELETE FROM vendor_urls v
USING ranked r
WHERE v.ctid = r.ctid
  AND r.rn > 1;

-- 2) Add a uniqueness constraint so the database enforces it going forward.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uk_vendor_urls_vendorid_uri'
  ) THEN
    ALTER TABLE vendor_urls
      ADD CONSTRAINT uk_vendor_urls_vendorid_uri UNIQUE ("VendorId", "Uri");
  END IF;
END $$;


