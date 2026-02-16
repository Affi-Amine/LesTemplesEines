-- Migration: Add images array column to salons table
-- Date: 2025-02-15
-- Purpose: Support multiple photos per salon with carousel display

-- Add images array column (keep image_url for backward compatibility)
ALTER TABLE salons ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';

-- Migrate existing single image to array
UPDATE salons
SET images = ARRAY[image_url]
WHERE image_url IS NOT NULL
  AND image_url != ''
  AND (images IS NULL OR images = '{}');

-- Comment explaining the columns
COMMENT ON COLUMN salons.image_url IS 'Legacy single image field - kept for backward compatibility';
COMMENT ON COLUMN salons.images IS 'Array of image URLs for carousel display';
