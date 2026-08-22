export const ATTENDANCE_STATUSES = [
  "present",
  "online",
  "late",
  "absent",
  "excused",
] as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

/** Có mặt tại lớp, học online hoặc đi trễ đều được tính là đã tham gia buổi học. */
export function isAttendedStatus(status: AttendanceStatus): boolean {
  return status === "present" || status === "online" || status === "late";
}

/** Bấm lại đúng trạng thái đang chọn sẽ đưa học viên về “Chưa điểm danh”. */
export function toggleAttendanceStatus(
  marks: Record<string, AttendanceStatus>,
  studentId: string,
  status: AttendanceStatus,
): Record<string, AttendanceStatus> {
  const next = { ...marks };
  if (next[studentId] === status) delete next[studentId];
  else next[studentId] = status;
  return next;
}

export function attendanceMarksChanged(
  current: Record<string, AttendanceStatus>,
  saved: Record<string, AttendanceStatus>,
): boolean {
  const currentEntries = Object.entries(current);
  const savedEntries = Object.entries(saved);
  if (currentEntries.length !== savedEntries.length) return true;
  return currentEntries.some(([studentId, status]) => saved[studentId] !== status);
}
