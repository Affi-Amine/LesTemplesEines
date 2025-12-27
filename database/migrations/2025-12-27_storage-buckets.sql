-- ============================================================================
-- LES TEMPLES - STORAGE BUCKETS SETUP
-- Migration: 2025-12-27 - Create storage buckets for images
-- ============================================================================
-- This script creates storage buckets for salon images and staff photos
-- with appropriate public access policies.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CREATE STORAGE BUCKETS
-- ----------------------------------------------------------------------------

-- Create salon-images bucket (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'salon-images',
  'salon-images',
  true, -- Public bucket
  5242880, -- 5MB limit (5 * 1024 * 1024 bytes)
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Create staff-photos bucket (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'staff-photos',
  'staff-photos',
  true, -- Public bucket
  5242880, -- 5MB limit (5 * 1024 * 1024 bytes)
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. DROP EXISTING POLICIES (if any)
-- ----------------------------------------------------------------------------

-- Drop existing policies for salon-images
DROP POLICY IF EXISTS "Public Access to Salon Images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload salon images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update salon images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete salon images" ON storage.objects;

-- Drop existing policies for staff-photos
DROP POLICY IF EXISTS "Public Access to Staff Photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload staff photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update staff photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete staff photos" ON storage.objects;

-- ----------------------------------------------------------------------------
-- 3. CREATE POLICIES FOR SALON-IMAGES BUCKET
-- ----------------------------------------------------------------------------

-- Allow public read access to salon images
CREATE POLICY "Public Access to Salon Images"
ON storage.objects FOR SELECT
USING (bucket_id = 'salon-images');

-- Allow authenticated users to upload salon images
CREATE POLICY "Authenticated users can upload salon images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'salon-images');

-- Allow authenticated users to update salon images
CREATE POLICY "Authenticated users can update salon images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'salon-images')
WITH CHECK (bucket_id = 'salon-images');

-- Allow authenticated users to delete salon images
CREATE POLICY "Authenticated users can delete salon images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'salon-images');

-- ----------------------------------------------------------------------------
-- 4. CREATE POLICIES FOR STAFF-PHOTOS BUCKET
-- ----------------------------------------------------------------------------

-- Allow public read access to staff photos
CREATE POLICY "Public Access to Staff Photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'staff-photos');

-- Allow authenticated users to upload staff photos
CREATE POLICY "Authenticated users can upload staff photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'staff-photos');

-- Allow authenticated users to update staff photos
CREATE POLICY "Authenticated users can update staff photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'staff-photos')
WITH CHECK (bucket_id = 'staff-photos');

-- Allow authenticated users to delete staff photos
CREATE POLICY "Authenticated users can delete staff photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'staff-photos');

-- ----------------------------------------------------------------------------
-- 5. VERIFICATION QUERIES (optional - can be run separately)
-- ----------------------------------------------------------------------------

-- Verify buckets were created
-- SELECT * FROM storage.buckets WHERE id IN ('salon-images', 'staff-photos');

-- Verify policies were created
-- SELECT * FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
