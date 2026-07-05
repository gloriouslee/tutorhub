-- Storage policies cho cả 3 bucket (class-materials, homework-submissions, avatars)
-- Chạy trong Supabase SQL Editor. Cho phép anon đọc/ghi — phù hợp giai đoạn 1
-- (app chưa bắt buộc auth); siết lại theo auth.uid() ở giai đoạn 2.

DROP POLICY IF EXISTS "Public can view class materials" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload class materials" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update class materials" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete class materials" ON storage.objects;
DROP POLICY IF EXISTS "phase1_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "phase1_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "phase1_storage_update" ON storage.objects;
DROP POLICY IF EXISTS "phase1_storage_delete" ON storage.objects;

CREATE POLICY "phase1_storage_select" ON storage.objects
  FOR SELECT USING (bucket_id IN ('class-materials', 'homework-submissions', 'avatars'));

CREATE POLICY "phase1_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id IN ('class-materials', 'homework-submissions', 'avatars'));

CREATE POLICY "phase1_storage_update" ON storage.objects
  FOR UPDATE USING (bucket_id IN ('class-materials', 'homework-submissions', 'avatars'));

CREATE POLICY "phase1_storage_delete" ON storage.objects
  FOR DELETE USING (bucket_id IN ('class-materials', 'homework-submissions', 'avatars'));
