-- ============================================================
-- Steps 1 & 2 Migrations — Landing Page Overhaul
-- Run these in Supabase SQL Editor (Dashboard → SQL Editor).
-- All statements use IF NOT EXISTS so they are safe to re-run.
-- ============================================================

-- ── Step 1 fields ──────────────────────────────────────────

-- Brand / Business name shown in the landing page nav
ALTER TABLE courses ADD COLUMN IF NOT EXISTS brand_name TEXT;

-- Instructor title / credentials line under instructor name
ALTER TABLE courses ADD COLUMN IF NOT EXISTS instructor_title TEXT;

-- Course difficulty level (Beginner / Intermediate / Advanced / All Levels)
ALTER TABLE courses ADD COLUMN IF NOT EXISTS level TEXT;

-- Course category for the hero badge (e.g. "Digital Marketing")
ALTER TABLE courses ADD COLUMN IF NOT EXISTS category TEXT;

-- Prerequisites / requirements bullet list
ALTER TABLE courses ADD COLUMN IF NOT EXISTS requirements TEXT[];

-- ── Step 2 fields ──────────────────────────────────────────

-- YouTube promo video URL — shown beside hero text on desktop
ALTER TABLE courses ADD COLUMN IF NOT EXISTS promo_video_url TEXT;

-- "Who is this for?" bullet list
ALTER TABLE courses ADD COLUMN IF NOT EXISTS target_audience TEXT[];

-- Student testimonials — array of {name, text, rating} objects
-- Stored as JSONB so individual fields are queryable if needed later.
ALTER TABLE courses ADD COLUMN IF NOT EXISTS testimonials JSONB;

-- ── Step 4 fields ──────────────────────────────────────────

-- Which sections are visible on the landing page
-- Stored as JSONB: { stats: true, curriculum: false, ... }
ALTER TABLE courses ADD COLUMN IF NOT EXISTS landing_sections JSONB;

-- Font pair override — overrides the theme's default heading font
-- NULL means "use theme default"
ALTER TABLE courses ADD COLUMN IF NOT EXISTS landing_font_pair TEXT;

-- ============================================================
-- Optional: verify added columns
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'courses'
--   AND column_name IN (
--     'brand_name','instructor_title','level','category','requirements',
--     'promo_video_url','target_audience','testimonials'
--   )
-- ORDER BY column_name;
-- ============================================================
