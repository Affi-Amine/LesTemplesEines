-- ============================================================================
-- QUICK RUN: Storage Buckets Setup for Les Temples
-- ============================================================================
-- This is a simplified version of the migration script for quick execution.
-- Copy and paste this entire script into Supabase SQL Editor and click Run.
-- ============================================================================

-- Create salon-images bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'salon-images',
  'salon-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Create staff-photos bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'staff-photos',
  'staff-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Create service-images bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'service-images',
  'service-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies (if any)
DROP POLICY IF EXISTS "Public Access to Salon Images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload salon images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update salon images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete salon images" ON storage.objects;
DROP POLICY IF EXISTS "Public Access to Staff Photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload staff photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update staff photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete staff photos" ON storage.objects;
DROP POLICY IF EXISTS "Public Access to Service Images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload service images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update service images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete service images" ON storage.objects;

-- Policies for salon-images
CREATE POLICY "Public Access to Salon Images"
ON storage.objects FOR SELECT
USING (bucket_id = 'salon-images');

CREATE POLICY "Authenticated users can upload salon images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'salon-images');

CREATE POLICY "Authenticated users can update salon images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'salon-images')
WITH CHECK (bucket_id = 'salon-images');

CREATE POLICY "Authenticated users can delete salon images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'salon-images');

-- Policies for staff-photos
CREATE POLICY "Public Access to Staff Photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'staff-photos');

CREATE POLICY "Authenticated users can upload staff photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'staff-photos');

CREATE POLICY "Authenticated users can update staff photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'staff-photos')
WITH CHECK (bucket_id = 'staff-photos');

CREATE POLICY "Authenticated users can delete staff photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'staff-photos');

-- Policies for service-images
CREATE POLICY "Public Access to Service Images"
ON storage.objects FOR SELECT
USING (bucket_id = 'service-images');

CREATE POLICY "Authenticated users can upload service images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'service-images');

CREATE POLICY "Authenticated users can update service images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'service-images')
WITH CHECK (bucket_id = 'service-images');

CREATE POLICY "Authenticated users can delete service images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'service-images');

-- ============================================================================
-- Verification (run separately after the above)
-- ============================================================================

-- Check if buckets were created
SELECT * FROM storage.buckets
WHERE id IN ('salon-images', 'staff-photos', 'service-images');
-- Expected: 3 rows

-- Check if policies were created
SELECT policyname
FROM pg_policies
WHERE tablename = 'objects' AND schemaname = 'storage'
ORDER BY policyname;
-- Expected: 12 policies
