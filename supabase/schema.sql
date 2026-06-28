-- TutorHub Database Schema
-- Run in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================
-- USERS TABLE (extends Supabase auth.users)
-- =====================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('student', 'parent', 'teacher', 'admin')) DEFAULT 'student',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'role', 'student'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =====================
-- STUDENTS
-- =====================
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  dob DATE,
  school TEXT,
  grade TEXT,
  learning_type TEXT CHECK (learning_type IN ('online', 'offline', 'hybrid')) DEFAULT 'hybrid',
  parent_id UUID,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own record" ON public.students
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Teachers and admins can view all students" ON public.students
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('teacher', 'admin')
    )
  );

-- =====================
-- PARENTS
-- =====================
CREATE TABLE public.parents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.parents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can view own record" ON public.parents
  FOR SELECT USING (user_id = auth.uid());

-- =====================
-- TEACHERS
-- =====================
CREATE TABLE public.teachers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  specialization TEXT,
  bio TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view teachers" ON public.teachers
  FOR SELECT USING (TRUE);

-- =====================
-- CLASSES
-- =====================
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  learning_mode TEXT CHECK (learning_mode IN ('online', 'offline', 'hybrid')) NOT NULL,
  tutor_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  classroom TEXT,
  zoom_link TEXT,
  schedule JSONB DEFAULT '[]',
  description TEXT,
  max_students INTEGER DEFAULT 15,
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view classes" ON public.classes
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Teachers can manage own classes" ON public.classes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.teachers t
      JOIN public.profiles p ON t.user_id = p.id
      WHERE p.id = auth.uid() AND t.id = tutor_id
    )
  );

-- =====================
-- ENROLLMENTS
-- =====================
CREATE TABLE public.enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('active', 'inactive', 'completed')) DEFAULT 'active',
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (student_id, class_id)
);

ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own enrollments" ON public.enrollments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.students WHERE id = student_id AND user_id = auth.uid())
  );

-- =====================
-- ATTENDANCE
-- =====================
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  status TEXT CHECK (status IN ('present', 'absent', 'late', 'excused')) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own attendance" ON public.attendance
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.students WHERE id = student_id AND user_id = auth.uid())
  );

CREATE POLICY "Teachers can manage attendance for their classes" ON public.attendance
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.classes c
      JOIN public.teachers t ON c.tutor_id = t.id
      JOIN public.profiles p ON t.user_id = p.id
      WHERE c.id = class_id AND p.id = auth.uid()
    )
  );

-- =====================
-- HOMEWORK
-- =====================
CREATE TABLE public.homework (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE NOT NULL,
  attachments TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.homework ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students in class can view homework" ON public.homework
  FOR SELECT USING (auth.role() = 'authenticated');

-- =====================
-- SUBMISSIONS
-- =====================
CREATE TABLE public.submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  homework_id UUID REFERENCES public.homework(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  file_url TEXT,
  text_content TEXT,
  score NUMERIC(5,2),
  feedback TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  graded_at TIMESTAMPTZ,
  status TEXT CHECK (status IN ('submitted', 'graded', 'returned')) DEFAULT 'submitted',
  UNIQUE (homework_id, student_id)
);

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view and create own submissions" ON public.submissions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.students WHERE id = student_id AND user_id = auth.uid())
  );

-- =====================
-- PAYMENTS
-- =====================
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL,
  due_date DATE NOT NULL,
  paid_date DATE,
  payment_status TEXT CHECK (payment_status IN ('paid', 'pending', 'overdue')) DEFAULT 'pending',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can view payments for their children" ON public.payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.students s
      JOIN public.parents p ON s.parent_id = p.id
      WHERE s.id = student_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all payments" ON public.payments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- =====================
-- NOTIFICATIONS
-- =====================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  target_role TEXT CHECK (target_role IN ('student', 'parent', 'teacher', 'admin', 'all')) NOT NULL,
  target_id UUID,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (
    target_role = 'all' OR
    target_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = target_role
    )
  );

-- =====================
-- MATERIALS
-- =====================
CREATE TABLE public.materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_type TEXT,
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enrolled students can view materials" ON public.materials
  FOR SELECT USING (auth.role() = 'authenticated');

-- =====================
-- EXAM SCORES
-- =====================
CREATE TABLE public.exam_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  exam_name TEXT NOT NULL,
  score NUMERIC(5,2) NOT NULL,
  max_score NUMERIC(5,2) DEFAULT 100,
  exam_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.exam_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own scores" ON public.exam_scores
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.students WHERE id = student_id AND user_id = auth.uid())
  );

-- =====================
-- STORAGE BUCKETS
-- =====================
INSERT INTO storage.buckets (id, name, public) VALUES
  ('avatars', 'avatars', true),
  ('homework-submissions', 'homework-submissions', false),
  ('class-materials', 'class-materials', false)
ON CONFLICT DO NOTHING;

-- Storage policies
CREATE POLICY "Avatar images are publicly viewable" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload own avatar" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Students can upload submissions" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'homework-submissions' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view materials" ON storage.objects
  FOR SELECT USING (bucket_id = 'class-materials' AND auth.role() = 'authenticated');

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;
