-- Run this SQL in your Supabase SQL Editor to create the necessary table and storage bucket

-- 1. Create the design_submissions table
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

-- 2. Enable Row Level Security (RLS)
ALTER TABLE design_submissions ENABLE ROW LEVEL SECURITY;

-- 3. Create a policy to allow inserts (for your API)
-- Adjust this policy based on your security needs
CREATE POLICY "Allow service role to insert" ON design_submissions
  FOR INSERT
  WITH CHECK (true);

-- 4. Create a policy to allow reads (optional - adjust as needed)
CREATE POLICY "Allow service role to read" ON design_submissions
  FOR SELECT
  USING (true);

-- 5. Create storage bucket for design uploads
-- Note: You'll need to create this bucket manually in Supabase Dashboard:
-- Go to Storage > New Bucket
-- Name: design-uploads
-- Public: true (if you want public URLs) or false (if private)
-- File size limit: 10MB (or your preferred limit)

-- 6. Create storage policy to allow uploads
-- Run this after creating the bucket in the dashboard
-- INSERT INTO storage.buckets (id, name, public) VALUES ('design-uploads', 'design-uploads', true);

-- 7. Create storage policy for uploads (adjust based on your needs)
-- This allows authenticated users to upload - you may want to adjust this
CREATE POLICY "Allow authenticated uploads" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'design-uploads');

CREATE POLICY "Allow public read" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'design-uploads');
