export type UserRole = "student" | "parent" | "teacher" | "admin";

export interface User {
  id: string;
  email: string;
  phone?: string;
  role: UserRole;
  created_at: string;
}

export interface Student {
  id: string;
  user_id: string;
  full_name: string;
  email?: string;
  dob: string;
  school: string;
  grade: string;
  learning_type: "online" | "offline" | "hybrid";
  parent_id?: string;
  avatar_url?: string;
  created_at: string;
}

export interface Parent {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  avatar_url?: string;
  created_at: string;
}

export interface Teacher {
  id: string;
  user_id: string;
  full_name: string;
  specialization: string;
  avatar_url?: string;
  bio?: string;
  created_at: string;
}

export interface Class {
  id: string;
  class_name: string;
  subject: string;
  grade?: number;
  learning_mode: "online" | "offline" | "hybrid";
  tutor_id: string;
  classroom?: string;
  zoom_link?: string;
  schedule: ClassSchedule[];
  description?: string;
  max_students?: number;
  color?: string;
  created_at: string;
}

export interface ClassSchedule {
  day: string;
  start_time: string;
  end_time: string;
}

export interface Enrollment {
  id: string;
  student_id: string;
  class_id: string;
  enrolled_at: string;
  status: "active" | "inactive" | "completed";
}

export interface Attendance {
  id: string;
  class_id: string;
  student_id: string;
  attendance_date: string;
  status: "present" | "absent" | "late" | "excused";
  notes?: string;
  created_at: string;
}

export interface Homework {
  id: string;
  class_id: string;
  title: string;
  description: string;
  due_date: string;
  attachments?: string[];
  created_at: string;
}

export interface Submission {
  id: string;
  homework_id: string;
  student_id: string;
  file_url?: string;
  text_content?: string;
  score?: number;
  feedback?: string;
  submitted_at: string;
  graded_at?: string;
  status: "submitted" | "graded" | "returned";
}

export interface Payment {
  id: string;
  student_id: string;
  class_id?: string;
  amount: number;
  due_date: string;
  paid_date?: string;
  payment_status: "paid" | "pending" | "overdue";
  description?: string;
  created_at: string;
}

export type NotificationCategory = "general" | "assignment" | "graded" | "system" | "schedule";

export interface Notification {
  id: string;
  title: string;
  content: string;
  target_role: UserRole | "all";
  target_id?: string;
  is_read: boolean;
  created_at: string;
  category?: NotificationCategory;
  sent_by?: string;
  target_class_id?: string;
  target_class_name?: string;
}

export interface Material {
  id: string;
  class_id: string;
  title: string;
  description?: string;
  file_url: string;
  file_type: string;
  uploaded_by: string;
  created_at: string;
}

export interface Announcement {
  id: string;
  class_id: string;
  teacher_id: string;
  title: string;
  content: string;
  created_at: string;
}

export interface ExamScore {
  id: string;
  student_id: string;
  class_id: string;
  exam_name: string;
  score: number;
  max_score: number;
  exam_date: string;
  notes?: string;
}

// Dashboard stats
export interface StudentDashboardStats {
  totalClasses: number;
  attendanceRate: number;
  pendingHomework: number;
  averageScore: number;
}

export interface TeacherDashboardStats {
  totalStudents: number;
  totalClasses: number;
  todayClasses: number;
  pendingGrading: number;
}

export interface AdminDashboardStats {
  totalStudents: number;
  totalTeachers: number;
  totalClasses: number;
  monthlyRevenue: number;
  attendanceRate: number;
  pendingPayments: number;
}
