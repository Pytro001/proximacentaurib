# Supabase Setup Instructions

Follow these steps to configure your Supabase project for file uploads:

## 1. Get Your Supabase Credentials

1. Go to your Supabase project dashboard: https://app.supabase.com
2. Select your project (or create a new one)
3. Go to **Project Settings** > **API**
4. Copy the following values:
   - **Project URL** → Use for `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → Use for `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → Use for `SUPABASE_SERVICE_ROLE_KEY` (⚠️ Keep this secret!)

## 2. Create Environment Variables

1. Copy `.env.local.example` to `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```

2. Open `.env.local` and fill in your Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   ```

## 3. Create the Database Table

1. Go to your Supabase dashboard
2. Navigate to **SQL Editor**
3. Run the SQL from `supabase-setup.sql` file, or copy-paste this:

```sql
-- Create the design_submissions table
CREATE TABLE IF NOT EXISTS design_submissions (
  id BIGSERIAL PRIMARY KEY,
  file_name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE design_submissions ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role to insert
CREATE POLICY "Allow service role to insert" ON design_submissions
  FOR INSERT
  WITH CHECK (true);

-- Create policy to allow service role to read
CREATE POLICY "Allow service role to read" ON design_submissions
  FOR SELECT
  USING (true);
```

## 4. Create Storage Bucket

1. Go to **Storage** in your Supabase dashboard
2. Click **New Bucket**
3. Configure:
   - **Name**: `design-uploads`
   - **Public bucket**: ✅ Yes (if you want public URLs) or ❌ No (if private)
   - **File size limit**: 10MB (or your preferred limit)
4. Click **Create bucket**

## 5. Set Storage Policies

After creating the bucket, go to **Storage** > **Policies** and create these policies:

**Policy 1: Allow uploads**
- Policy name: "Allow authenticated uploads"
- Allowed operation: INSERT
- Target roles: service_role
- USING expression: `bucket_id = 'design-uploads'`

**Policy 2: Allow reads** (if bucket is public, this may not be needed)
- Policy name: "Allow public read"
- Allowed operation: SELECT
- Target roles: public
- USING expression: `bucket_id = 'design-uploads'`

Or run this SQL in the SQL Editor:

```sql
-- Allow service role to upload
CREATE POLICY "Allow authenticated uploads" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'design-uploads');

-- Allow public read (if bucket is public)
CREATE POLICY "Allow public read" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'design-uploads');
```

## 6. Test the Setup

1. Restart your Next.js dev server:
   ```bash
   npm run dev
   ```

2. Open your website and try uploading a file
3. Check your Supabase dashboard:
   - **Storage** > `design-uploads` bucket should show your uploaded file
   - **Table Editor** > `design_submissions` should show a new row with file details

## Troubleshooting

- **"Missing Supabase environment variables"**: Make sure `.env.local` exists and has all three variables
- **"Failed to upload file"**: Check that the storage bucket exists and policies are set correctly
- **"Failed to save record"**: Verify the `design_submissions` table exists and RLS policies allow inserts
- **403 Forbidden**: Check storage bucket policies and make sure service_role key is correct

## Security Notes

- ⚠️ Never commit `.env.local` to git (it's already in `.gitignore`)
- ⚠️ The `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS - keep it secret and only use server-side
- Consider adding authentication/rate limiting for production use
