export type ClassRegistrationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled";

export type RegistrationSource = "class" | "material";
export type RegistrationPackage = "online" | "advanced" | "offline";

export interface ClassRegistrationTuition {
  period: string;
  billing_unit: "session";
  online: number;
  advanced: number;
  offline: number;
}

export interface ClassRegistrationRequest {
  id: string;
  student_id: string;
  requested_class_id: string;
  assigned_class_id?: string | null;
  source: RegistrationSource;
  resource_id?: string | null;
  requested_package?: RegistrationPackage | null;
  requested_unit_price?: number | null;
  tuition_period?: string | null;
  student_note?: string | null;
  teacher_note?: string | null;
  status: ClassRegistrationStatus;
  created_at: string;
  reviewed_at?: string | null;
  student?: {
    id: string;
    full_name: string;
    email?: string;
    school?: string;
    grade?: string;
  };
  requested_class?: {
    id: string;
    class_name: string;
    subject: string;
  };
  assigned_class?: {
    id: string;
    class_name: string;
    subject: string;
  } | null;
}

export interface CatalogLessonOutline {
  id: string;
  title: string;
  type: string;
  duration?: string;
}

export interface CatalogChapterOutline {
  id: string;
  title: string;
  sessions?: Array<{
    id: string;
    title: string;
    date?: string;
  }>;
  lessons?: CatalogLessonOutline[];
}

export interface CatalogMaterial {
  id: string;
  class_id: string;
  title: string;
  subject: string;
  description: string;
  chapters: CatalogChapterOutline[];
}

export interface ClassCatalogItem {
  id: string;
  class_name: string;
  subject: string;
  grade?: number | null;
  learning_mode: "online" | "offline" | "hybrid";
  tutor_id: string;
  tutor_name: string;
  classroom?: string | null;
  schedule: Array<{ day: string; start_time: string; end_time: string }>;
  description?: string | null;
  max_students?: number | null;
  student_count: number;
  color?: string | null;
  enrolled: boolean;
  registration_status?: ClassRegistrationStatus | null;
  registration_id?: string | null;
  registration_package?: RegistrationPackage | null;
  tuition: ClassRegistrationTuition;
  roadmap: CatalogChapterOutline[];
  materials: CatalogMaterial[];
}
