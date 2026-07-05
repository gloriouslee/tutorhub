"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { submitCourseReview, type CourseReview } from "@/lib/storage";
import { Star, X } from "lucide-react";

// ── Review modal ──────────────────────────────────────────────────────────────

export default function ReviewModal({
  courseId, courseName, studentId, studentName, existingReview, onSave, onClose,
}: {
  courseId: string; courseName: string;
  studentId: string; studentName: string;
  existingReview?: CourseReview;
  onSave: () => void; onClose: () => void;
}) {
  const [rating, setRating]   = useState(existingReview?.rating ?? 0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState(existingReview?.comment ?? "");

  function handleSubmit() {
    if (!rating) return;
    submitCourseReview({
      course_id: courseId, student_id: studentId, student_name: studentName,
      rating, comment: comment.trim() || undefined,
      created_at: new Date().toISOString(),
    });
    onSave();
    onClose();
  }

  const display = hovered || rating;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <p className="font-semibold text-foreground text-sm">Đánh giá khóa học</p>
            <p className="text-xs text-muted-foreground line-clamp-1">{courseName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Star picker */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex gap-1">
              {[1,2,3,4,5].map(s => (
                <button
                  key={s}
                  onMouseEnter={() => setHovered(s)}
                  onMouseLeave={() => setHovered(0)}
                  onClick={() => setRating(s)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Star className={`h-8 w-8 transition-colors ${s <= display ? "fill-amber-400 text-amber-400" : "text-border"}`} />
                </button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              {display === 0 ? "Chọn số sao" : display === 1 ? "Rất tệ" : display === 2 ? "Tệ" : display === 3 ? "Bình thường" : display === 4 ? "Tốt" : "Xuất sắc"}
            </p>
          </div>
          {/* Comment */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Nhận xét (tuỳ chọn)</label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={3}
              placeholder="Chia sẻ cảm nhận của bạn về khóa học..."
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-primary/40 text-foreground"
            />
          </div>
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <Button variant="outline" className="flex-1" onClick={onClose}>Huỷ</Button>
          <Button variant="gradient" className="flex-1" disabled={!rating} onClick={handleSubmit}>
            <Star className="h-3.5 w-3.5 mr-1.5 fill-current" />
            {existingReview ? "Cập nhật" : "Gửi đánh giá"}
          </Button>
        </div>
      </div>
    </div>
  );
}
