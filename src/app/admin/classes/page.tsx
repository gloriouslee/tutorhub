"use client";

import { toLocalDateKey } from "@/lib/utils";

import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LearningModeBadge, SectionHeader } from "@/components/shared";
import { Search, Plus, X, Edit, Trash2, Calendar, MapPin, Video, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getClasses, saveClasses, getTeachers, getStudents, setClassTeacherOverride } from "@/lib/storage";
import { Class, Teacher, Student } from "@/types";

function AdminClassesPageInner() {
  const searchParams = useSearchParams();
  const teacherParam = searchParams.get("teacher") ?? "";
  const studentParam = searchParams.get("student") ?? "";

  const [classes, setClasses] = useState<Class[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<"All" | "online" | "offline" | "hybrid">("All");
  const [filterTeacher, setFilterTeacher] = useState(teacherParam);
  const [filterStudent, setFilterStudent] = useState(studentParam);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [formData, setFormData] = useState({
    class_name: "",
    subject: "Toán học",
    learning_mode: "online" as "online" | "offline" | "hybrid",
    tutor_id: "",
    classroom: "",
    zoom_link: "",
    schedule_day: "Monday",
    start_time: "18:00",
    end_time: "19:30",
    description: "",
    max_students: 15,
  });

  useEffect(() => {
    async function loadData() {
      const [c, t, s] = await Promise.all([
        getClasses(),
        getTeachers(),
        getStudents(),
      ]);
      setClasses(c);
      setTeachers(t);
      setStudents(s);
    }
    loadData();
  }, []);

  const handleOpenAddModal = () => {
    const defaultTutor = teachers[0]?.id || "";
    setEditingClass(null);
    setFormData({
      class_name: "",
      subject: "Toán học",
      learning_mode: "online",
      tutor_id: defaultTutor,
      classroom: "Phòng 101",
      zoom_link: "https://zoom.us/j/123456789",
      schedule_day: "Monday",
      start_time: "18:00",
      end_time: "19:30",
      description: "",
      max_students: 15,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (cls: Class) => {
    setEditingClass(cls);
    const primarySchedule = cls.schedule[0] || { day: "Monday", start_time: "18:00", end_time: "19:30" };
    setFormData({
      class_name: cls.class_name,
      subject: cls.subject,
      learning_mode: cls.learning_mode,
      tutor_id: cls.tutor_id,
      classroom: cls.classroom || "",
      zoom_link: cls.zoom_link || "",
      schedule_day: primarySchedule.day,
      start_time: primarySchedule.start_time,
      end_time: primarySchedule.end_time,
      description: cls.description || "",
      max_students: cls.max_students || 15,
    });
    setIsModalOpen(true);
  };

  const handleDeleteClass = async (id: string) => {
    if (confirm("Xác nhận xóa lớp học này?")) {
      const updated = classes.filter(c => c.id !== id);
      setClasses(updated);
      await saveClasses(updated);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const scheduleData = [
      {
        day: formData.schedule_day,
        start_time: formData.start_time,
        end_time: formData.end_time,
      },
    ];

    if (editingClass) {
      // Edit
      const updated = classes.map(c =>
        c.id === editingClass.id
          ? {
              ...c,
              class_name: formData.class_name,
              subject: formData.subject,
              learning_mode: formData.learning_mode,
              tutor_id: formData.tutor_id,
              classroom: formData.learning_mode === "offline" ? formData.classroom : undefined,
              zoom_link: formData.learning_mode !== "offline" ? formData.zoom_link : undefined,
              schedule: scheduleData,
              description: formData.description,
              max_students: Number(formData.max_students),
            }
          : c
      );
      setClasses(updated);
      await saveClasses(updated);
      // Persist teacher assignment so teacher portal picks it up
      setClassTeacherOverride(editingClass.id, formData.tutor_id);
    } else {
      // Add
      const newId = `c${classes.length + 1}-${Math.floor(Math.random() * 1000)}`;
      const newClass: Class = {
        id: newId,
        class_name: formData.class_name,
        subject: formData.subject,
        learning_mode: formData.learning_mode,
        tutor_id: formData.tutor_id,
        classroom: formData.learning_mode === "offline" ? formData.classroom : undefined,
        zoom_link: formData.learning_mode !== "offline" ? formData.zoom_link : undefined,
        schedule: scheduleData,
        description: formData.description,
        max_students: Number(formData.max_students),
        color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
        created_at: toLocalDateKey(new Date()),
      };
      const updated = [...classes, newClass];
      setClasses(updated);
      await saveClasses(updated);
    }
    setIsModalOpen(false);
  };

  const filtered = classes.filter(c => {
    const matchesSearch =
      c.class_name.toLowerCase().includes(search.toLowerCase()) ||
      c.subject.toLowerCase().includes(search.toLowerCase());
    const matchesMode =
      filterMode === "All" ||
      c.learning_mode === filterMode;
    const matchesTeacher =
      !filterTeacher ||
      c.tutor_id === filterTeacher;
    const matchesStudent =
      !filterStudent ||
      ((c as any).student_ids ?? []).includes(filterStudent);
    return matchesSearch && matchesMode && matchesTeacher && matchesStudent;
  });

  return (
    <PortalLayout role="admin" userName="Admin User" pageTitle="Lớp học">
      <div className="space-y-6">
        <SectionHeader
          title="Danh sách Lớp học"
          subtitle={`Tổng cộng ${classes.length} lớp đang hoạt động`}
          action={
            <Button variant="gradient" onClick={handleOpenAddModal}>
              <Plus className="h-4 w-4 mr-1" /> Tạo lớp mới
            </Button>
          }
        />

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <Input
            placeholder="Tìm lớp học hoặc môn học..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
            className="w-64 bg-card"
          />
          <div className="flex items-center gap-2 ml-auto">
            {(["All", "online", "offline", "hybrid"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilterMode(f)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                  filterMode === f
                    ? "bg-rose-500 text-white shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                {{ All: "Tất cả", online: "Trực tuyến", offline: "Tại lớp", hybrid: "Kết hợp" }[f]}
              </button>
            ))}
          </div>
        </div>

        {/* Active filter banners */}
        {filterTeacher && (() => {
          const t = teachers.find(tc => tc.id === filterTeacher);
          return t ? (
            <div className="flex items-center gap-2 text-sm bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl px-4 py-2.5">
              <span className="text-rose-600 dark:text-rose-400 font-semibold">Lọc theo giáo viên:</span>
              <span className="text-foreground font-medium">{t.full_name}</span>
              <button onClick={() => setFilterTeacher("")} className="ml-auto text-rose-400 hover:text-rose-600 transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null;
        })()}
        {filterStudent && (() => {
          const s = students.find(st => st.id === filterStudent);
          return s ? (
            <div className="flex items-center gap-2 text-sm bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl px-4 py-2.5">
              <span className="text-rose-600 dark:text-rose-400 font-semibold">Lọc theo học viên:</span>
              <span className="text-foreground font-medium">{s.full_name}</span>
              <button onClick={() => setFilterStudent("")} className="ml-auto text-rose-400 hover:text-rose-600 transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null;
        })()}

        {/* Classes grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.length === 0 ? (
            <div className="col-span-full py-12 text-center text-muted-foreground text-sm">
              Không tìm thấy lớp học nào.
            </div>
          ) : (
            filtered.map((cls, i) => {
              const tutor = teachers.find(t => t.id === cls.tutor_id);
              // Mock student count for dynamic display
              const studentCount = 4 + (i * 2) % 8;

              return (
                <Card key={cls.id} className="animate-fade-in hover:shadow-lg transition-all border border-border" style={{ animationDelay: `${i * 30}ms` }}>
                  <CardContent className="p-5 flex flex-col justify-between gap-4 h-full">
                    <div className="space-y-3.5">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/20 text-rose-500">
                            {cls.subject}
                          </span>
                          <h4 className="text-base font-bold text-foreground mt-1.5">{cls.class_name}</h4>
                        </div>
                        <LearningModeBadge mode={cls.learning_mode} />
                      </div>

                      <p className="text-xs text-muted-foreground line-clamp-2 min-h-[32px]">
                        {cls.description || "Chưa có mô tả."}
                      </p>

                      <div className="space-y-2 text-xs text-muted-foreground border-t border-border pt-3">
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-rose-400" />
                          <span>Giáo viên: <strong className="text-foreground">{tutor?.full_name ?? "Chưa phân công"}</strong></span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 text-rose-400" />
                          <div>
                            {cls.schedule.map((sch, sIdx) => (
                              <span key={sIdx} className="block text-foreground font-medium">
                                {sch.day}: {sch.start_time} - {sch.end_time}
                              </span>
                            ))}
                          </div>
                        </div>
                        {cls.learning_mode === "offline" ? (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-3.5 w-3.5 text-rose-400" />
                            <span>Phòng: <strong className="text-foreground">{cls.classroom ?? "N/A"}</strong></span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Video className="h-3.5 w-3.5 text-rose-400" />
                            <a href={cls.zoom_link} target="_blank" rel="noreferrer" className="text-rose-500 hover:underline truncate max-w-[180px]">
                              {cls.zoom_link ?? "Zoom Link"}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-border pt-3 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground font-semibold">
                        Sĩ số: <strong className="text-foreground">{studentCount}</strong> / {cls.max_students || 15}
                      </span>
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="outline" className="h-8 py-0" onClick={() => handleOpenEditModal(cls)}>
                          <Edit className="h-3 w-3 mr-1" /> Sửa
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 py-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10" onClick={() => handleDeleteClass(cls.id)}>
                          <Trash2 className="h-3 w-3 mr-1" /> Xóa
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-border w-full max-w-md rounded-2xl p-6 shadow-2xl relative animate-scale-up max-h-[90vh] overflow-y-auto">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
            <h3 className="text-lg font-bold text-foreground mb-4">
              {editingClass ? "Chỉnh sửa Lớp học" : "Tạo Lớp học mới"}
            </h3>
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Tên lớp học *</label>
                <Input
                  required
                  value={formData.class_name}
                  onChange={e => setFormData({ ...formData, class_name: e.target.value })}
                  placeholder="VD: Toán Nâng Cao 12"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Môn học *</label>
                  <select
                    className="flex h-10 w-full items-center justify-between rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    value={formData.subject}
                    onChange={e => setFormData({ ...formData, subject: e.target.value })}
                  >
                    {["Toán học", "Vật lý", "Hóa học", "Tiếng Anh", "Ngữ Văn"].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Hình thức học *</label>
                  <select
                    className="flex h-10 w-full items-center justify-between rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    value={formData.learning_mode}
                    onChange={e => setFormData({ ...formData, learning_mode: e.target.value as any })}
                  >
                    <option value="online">Trực tuyến</option>
                    <option value="offline">Tại lớp</option>
                    <option value="hybrid">Kết hợp</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Giáo viên phụ trách *</label>
                <select
                  required
                  className="flex h-10 w-full items-center justify-between rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  value={formData.tutor_id}
                  onChange={e => setFormData({ ...formData, tutor_id: e.target.value })}
                >
                  <option value="" disabled>Chọn giáo viên</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.full_name} ({t.specialization})</option>
                  ))}
                </select>
              </div>

              {formData.learning_mode === "offline" ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Phòng học (Offline) *</label>
                  <Input
                    required
                    value={formData.classroom}
                    onChange={e => setFormData({ ...formData, classroom: e.target.value })}
                    placeholder="VD: Phòng 105"
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Zoom Link (Online/Hybrid) *</label>
                  <Input
                    required
                    value={formData.zoom_link}
                    onChange={e => setFormData({ ...formData, zoom_link: e.target.value })}
                    placeholder="VD: https://zoom.us/j/..."
                  />
                </div>
              )}

              <div className="border-t border-border pt-3">
                <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Lịch học</p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase">Thứ</label>
                    <select
                      className="flex h-9 w-full rounded-lg border border-input bg-card px-2 py-1 text-xs outline-none"
                      value={formData.schedule_day}
                      onChange={e => setFormData({ ...formData, schedule_day: e.target.value })}
                    >
                      {[
                        { val: "Monday",    label: "Thứ Hai" },
                        { val: "Tuesday",   label: "Thứ Ba" },
                        { val: "Wednesday", label: "Thứ Tư" },
                        { val: "Thursday",  label: "Thứ Năm" },
                        { val: "Friday",    label: "Thứ Sáu" },
                        { val: "Saturday",  label: "Thứ Bảy" },
                        { val: "Sunday",    label: "Chủ Nhật" },
                      ].map(d => (
                        <option key={d.val} value={d.val}>{d.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase">Từ</label>
                    <Input
                      type="text"
                      className="h-9 text-xs"
                      value={formData.start_time}
                      onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                      placeholder="18:00"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase">Đến</label>
                    <Input
                      type="text"
                      className="h-9 text-xs"
                      value={formData.end_time}
                      onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                      placeholder="19:30"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Sĩ số tối đa</label>
                  <Input
                    type="number"
                    value={formData.max_students}
                    onChange={e => setFormData({ ...formData, max_students: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Mô tả ngắn</label>
                  <Input
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    placeholder="VD: Củng cố kiến thức..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                  Hủy
                </Button>
                <Button type="submit" variant="gradient">
                  {editingClass ? "Lưu thay đổi" : "Tạo lớp"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}

export default function AdminClassesPage() {
  return (
    <Suspense>
      <AdminClassesPageInner />
    </Suspense>
  );
}
