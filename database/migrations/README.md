# Database Migrations

This folder contains SQL migration scripts for the Les Temples project.

## How to Apply Migrations

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** (left sidebar)
3. Click **New Query**
4. Copy and paste the entire contents of the migration file
5. Click **Run** or press `Ctrl+Enter` / `Cmd+Enter`
6. Verify success message appears

### Option 2: Supabase CLI

```bash
# If you have Supabase CLI installed
supabase db push
```

---

## Available Migrations

### 2025-12-27_storage-buckets.sql

**Purpose**: Creates storage buckets for image uploads

**What it does**:
- Creates `salon-images` bucket for salon photos
- Creates `staff-photos` bucket for staff member photos
- Creates `service-images` bucket for service images
- Sets up public read access for all three buckets
- Allows authenticated admin users to upload/update/delete images
- Sets 5MB file size limit
- Restricts to image formats: JPEG, PNG, WebP

**When to run**:
- Before using salon image upload feature in admin dashboard
- Before using staff photo upload feature in admin dashboard
- Before using service image upload feature in admin dashboard

**Status**: ✅ Ready to run

---

## Migration Status Tracking

| Migration File | Applied Date | Status | Notes |
|---------------|--------------|--------|-------|
| `2025-12-27_storage-buckets.sql` | _Pending_ | ⏳ Not Applied | Required for image uploads |

---

## Troubleshooting

### "relation storage.buckets does not exist"
- Make sure you're running this on your Supabase project, not a local database
- Storage is a Supabase-specific feature

### "permission denied for table storage.buckets"
- Make sure you're logged in as the project owner
- Run the script in the Supabase SQL Editor, not via external client

### "bucket already exists"
- The script uses `ON CONFLICT DO NOTHING` so it's safe to run multiple times
- Existing buckets won't be affected

### Verify buckets were created

Run this query in Supabase SQL Editor:
```sql
SELECT * FROM storage.buckets
WHERE id IN ('salon-images', 'staff-photos', 'service-images');
```

You should see 3 rows returned.

### Verify policies were created

Run this query in Supabase SQL Editor:
```sql
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE tablename = 'objects' AND schemaname = 'storage'
ORDER BY policyname;
```

You should see 12 policies (4 for each of the 3 buckets).

---

## Best Practices

1. **Always backup** your database before running migrations
2. **Test in development** environment first
3. **Run migrations in order** by date
4. **Mark completed migrations** in the status table above
5. **Keep this README updated** when adding new migrations
