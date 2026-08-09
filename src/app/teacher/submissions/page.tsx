import { redirect } from "next/navigation";

/**
 * Trang chấm bài đã được gộp vào /teacher/homework, nơi mỗi bài tập mở ra danh
 * sách bài nộp và chấm ngay tại chỗ. Giữ route này để các liên kết cũ và bookmark
 * không bị hỏng.
 */
export default function TeacherSubmissionsRedirect() {
  redirect("/teacher/homework");
}
