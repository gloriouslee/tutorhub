"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toLocalDateKey } from "@/lib/utils";
import { X, Check } from "lucide-react";

export default function FeedbackModal({ student, commentsList, onSave, onClose }: {
  student: any;
  commentsList: any[];
  onSave: (text: string, date: string, rating: number) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [date, setDate] = useState(toLocalDateKey(new Date()));
  const [rating, setRating] = useState(5);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-card w-full max-w-lg rounded-2xl shadow-xl border border-border overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="font-semibold text-foreground">Nhận xét học viên</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Học viên: {student.full_name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {commentsList && commentsList.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Lịch sử nhận xét gần đây</label>
              <div className="space-y-2 bg-muted/30 p-3 rounded-xl border border-border">
                {commentsList.map((c, i) => (
                  <div key={i} className="text-xs border-b border-border/50 last:border-0 pb-2 last:pb-0">
                    <div className="flex justify-between font-semibold mb-1">
                      <span className="text-muted-foreground">{c.date}</span>
                      <span className="text-amber-500">{"★".repeat(c.rating)}{"☆".repeat(5 - c.rating)}</span>
                    </div>
                    <p className="text-foreground">{c.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Ngày học *</label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Đánh giá chung *</label>
              <div className="flex items-center gap-1 h-10">
                {[1, 2, 3, 4, 5].map(star => (
                  <button type="button" key={star} onClick={() => setRating(star)}
                    className={`text-xl transition-all ${star <= rating ? "text-amber-400 scale-110" : "text-muted hover:text-amber-200"}`}>
                    ★
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Nội dung nhận xét <span className="text-red-500">*</span></label>
            <textarea required rows={4} value={text} onChange={e => setText(e.target.value)}
              className="w-full p-3 rounded-xl border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
              placeholder="Nhận xét về thái độ học tập, bài tập về nhà, mức độ tiếp thu..." />
          </div>
        </div>
        <div className="p-5 border-t border-border bg-muted/20 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button variant="gradient" disabled={!text} onClick={() => { onSave(text, date, rating); onClose(); }}>
            <Check className="h-4 w-4 mr-2" />Lưu nhận xét
          </Button>
        </div>
      </div>
    </div>
  );
}
