"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MOCK_STUDENTS } from "@/lib/mock-data";
import { Users, Plus, X } from "lucide-react";

export default function AddStudentModal({
  classId,
  enrolledIds,
  approvedEnrollments,
  onAdd,
  onClose,
}: {
  classId: string;
  enrolledIds: string[];
  approvedEnrollments: { id: string; full_name: string; email: string; school: string; grade: string }[];
  onAdd: (ids: string[]) => void;
  onClose: () => void;
}) {
  const mockAvailable = MOCK_STUDENTS
    .filter(s => !enrolledIds.includes(s.id))
    .map(s => ({ id: s.id, full_name: s.full_name, email: "", school: s.school ?? "", grade: s.grade ?? "", isEnrolled: false }));
  const enrolledAvailable = approvedEnrollments
    .filter(e => !enrolledIds.includes(e.id))
    .map(e => ({ ...e, isEnrolled: true }));
  const available = [...mockAvailable, ...enrolledAvailable];

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const filtered = available.filter(s => {
    const q = search.toLowerCase();
    return !q ||
      s.full_name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      s.school.toLowerCase().includes(q);
  });

  function toggle(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function handleAdd() {
    const newIds = [...selected];
    if (newIds.length === 0) return;
    try {
      const raw = localStorage.getItem(`tutorhub_class_extra_students_${classId}`);
      const existing: string[] = raw ? JSON.parse(raw) : [];
      const updated = [...new Set([...existing, ...newIds])];
      localStorage.setItem(`tutorhub_class_extra_students_${classId}`, JSON.stringify(updated));
    } catch {}
    onAdd(newIds);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-bold text-foreground">Thêm học viên</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Chọn học viên để thêm vào lớp</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-border shrink-0">
          <div className="relative">
            <Input
              placeholder="Tìm theo tên, email hoặc trường..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/50">
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-10">
              {available.length === 0 ? "Tất cả học viên đã trong lớp." : "Không tìm thấy học viên phù hợp."}
            </p>
          )}
          {filtered.map(student => {
            const checked = selected.has(student.id);
            return (
              <label key={student.id} className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-muted/30 transition-colors">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(student.id)}
                  className="h-4 w-4 accent-primary rounded"
                />
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                  {student.full_name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{student.full_name}</p>
                    {student.isEnrolled && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-1.5 py-0.5 rounded font-medium shrink-0">Đã duyệt</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {student.email || student.school} {student.grade ? `· Lớp ${student.grade}` : ""}
                  </p>
                </div>
              </label>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex items-center justify-between gap-3 shrink-0">
          <p className="text-xs text-muted-foreground">
            {selected.size > 0 ? `Đã chọn ${selected.size} học viên` : "Chưa chọn học viên nào"}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Hủy</Button>
            <Button variant="gradient" size="sm" onClick={handleAdd} disabled={selected.size === 0}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />Thêm {selected.size > 0 ? `(${selected.size})` : ""}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
