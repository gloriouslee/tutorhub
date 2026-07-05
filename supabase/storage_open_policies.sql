-- Allow anon/authenticated to upload and read files in class-materials bucket
-- Run this in the Supabase SQL editor for the class-materials bucket to work
-- without requiring a real authenticated session (suitable for dev/demo mode).

-- Make the bucket public so files are accessible via public URL
UPDATE storage.buckets SET public = true WHERE id = 'class-materials';

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Authenticated users can view materials" ON storage.objects;

-- Allow anyone (including anon) to view files
CREATE POLICY "Public can view class materials" ON storage.objects
  FOR SELECT USING (bucket_id = 'class-materials');

-- Allow anyone (including anon) to upload files
CREATE POLICY "Anyone can upload class materials" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'class-materials');

-- Allow anyone to update/delete their uploads
CREATE POLICY "Anyone can update class materials" ON storage.objects
  FOR UPDATE USING (bucket_id = 'class-materials');

CREATE POLICY "Anyone can delete class materials" ON storage.objects
  FOR DELETE USING (bucket_id = 'class-materials');
