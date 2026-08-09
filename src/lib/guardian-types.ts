export type GuardianRelationship = "mother" | "father" | "guardian" | "other";
export type GuardianLinkStatus = "pending" | "active" | "rejected" | "revoked";

export interface GuardianLink {
  id: string;
  student_id: string;
  parent_id: string;
  relationship: GuardianRelationship;
  status: GuardianLinkStatus;
  invited_email?: string | null;
  accepted_at?: string | null;
  rejected_at?: string | null;
  revoked_at?: string | null;
  created_at: string;
  updated_at: string;
  student?: {
    id: string;
    full_name: string;
    grade?: string | null;
    school?: string | null;
  } | null;
  parent?: {
    id: string;
    full_name: string;
    email?: string | null;
    phone?: string | null;
  } | null;
}

export const GUARDIAN_RELATIONSHIP_LABELS: Record<GuardianRelationship, string> = {
  mother: "Mẹ",
  father: "Bố",
  guardian: "Người giám hộ",
  other: "Khác",
};
