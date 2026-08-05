export type ClassQuestionStatus = "open" | "answered" | "closed";

export interface ClassQuestionMessage {
  id: string;
  author_role: "student" | "teacher";
  author_name: string;
  content: string;
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_size?: string | null;
  created_at: string;
}

export interface ClassQuestionThread {
  id: string;
  class_id: string;
  class_name: string;
  student_id: string;
  student_name: string;
  title: string;
  status: ClassQuestionStatus;
  last_message_role: "student" | "teacher";
  last_message_at: string;
  created_at: string;
  updated_at: string;
  messages: ClassQuestionMessage[];
}

export interface QuestionAttachmentInput {
  url: string;
  name: string;
  size?: string;
}
