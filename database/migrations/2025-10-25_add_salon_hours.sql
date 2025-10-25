-- Add default opening_hours to salons that don't have them
-- This migration adds opening hours in JSONB format for all salons

-- Update Temple Paris (or any salon with slug 'temple-paris')
UPDATE salons
SET opening_hours = '{
  "monday": {"open": "09:00", "close": "20:00"},
  "tuesday": {"open": "09:00", "close": "20:00"},
  "wednesday": {"open": "09:00", "close": "20:00"},
  "thursday": {"open": "09:00", "close": "20:00"},
  "friday": {"open": "09:00", "close": "20:00"},
  "saturday": {"open": "10:00", "close": "18:00"},
  "sunday": {"open": "10:00", "close": "18:00"}
}'::jsonb
WHERE slug = 'temple-paris' OR name ILIKE '%paris%';

-- Update Temple Lyon (or any salon with slug 'temple-lyon')
UPDATE salons
SET opening_hours = '{
  "monday": {"open": "09:00", "close": "20:00"},
  "tuesday": {"open": "09:00", "close": "20:00"},
  "wednesday": {"open": "09:00", "close": "20:00"},
  "thursday": {"open": "09:00", "close": "20:00"},
  "friday": {"open": "09:00", "close": "20:00"},
  "saturday": {"open": "10:00", "close": "18:00"},
  "sunday": {"open": "10:00", "close": "18:00"}
}'::jsonb
WHERE slug = 'temple-lyon' OR name ILIKE '%lyon%';

-- Update Temple Marseille (or any salon with slug 'temple-marseille')
UPDATE salons
SET opening_hours = '{
  "monday": {"open": "09:00", "close": "20:00"},
  "tuesday": {"open": "09:00", "close": "20:00"},
  "wednesday": {"open": "09:00", "close": "20:00"},
  "thursday": {"open": "09:00", "close": "20:00"},
  "friday": {"open": "09:00", "close": "20:00"},
  "saturday": {"open": "10:00", "close": "18:00"},
  "sunday": {"open": "10:00", "close": "18:00"}
}'::jsonb
WHERE slug = 'temple-marseille' OR name ILIKE '%marseille%';

-- If there are any salons without opening_hours, add default hours
UPDATE salons
SET opening_hours = '{
  "monday": {"open": "09:00", "close": "20:00"},
  "tuesday": {"open": "09:00", "close": "20:00"},
  "wednesday": {"open": "09:00", "close": "20:00"},
  "thursday": {"open": "09:00", "close": "20:00"},
  "friday": {"open": "09:00", "close": "20:00"},
  "saturday": {"open": "10:00", "close": "18:00"},
  "sunday": {"open": "10:00", "close": "18:00"}
}'::jsonb
WHERE opening_hours IS NULL OR opening_hours = '{}'::jsonb;
