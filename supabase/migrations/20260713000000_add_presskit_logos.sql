-- Adds an optional array of logo URLs to presskits.
-- DJs can upload up to 3 logos (brand assets) in the presskit editor; visitors
-- to the public profile can download them all as a single ZIP.
--
-- Logos reuse the existing public `pk-photos` Storage bucket (stored with a
-- `logo-` filename prefix under the user's folder), so no new bucket or policy
-- is required. Apply this manually in the Supabase SQL Editor.

ALTER TABLE presskits
  ADD COLUMN IF NOT EXISTS logo_urls jsonb NOT NULL DEFAULT '[]'::jsonb;
