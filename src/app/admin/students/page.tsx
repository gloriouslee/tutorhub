"use client";

import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LearningModeBadge, SectionHeader } from "@/components/shared";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ProgressBar } from "@/components/shared";
import { Search, Plus, X, Edit, Trash2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { getStudents, saveStudents, getPayments, getAttendance } from "@/lib/storage";
import { Student } from "@/types";

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<"All" | "Online" | "Offline" | "Hybrid">("All");

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    dob: "",
    grade: "Lớp 8",
    school: "",
    learning_type: "hybrid" as "online" | "offline" | "hybrid",
  });

  useEffect(() => {
    async function loadData() {
      const [s, p, a] = await Promise.all([
        getStudents(),
        getPayments(),
        getAttendance(),
      ]);
      setStudents(s);
      setPayments(p);
      setAttendance(a);
    }
    loadData();
  }, []);

  const handleOpenAddModal = () => {
    setEditingStudent(null);
    setFormData({ full_name: "", email: "", dob: "", grade: "Lớp 8", school: "", learning_type: "hybrid" });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      full_name: student.full_name,
      email: (student as any).email ?? "",
      dob: student.dob,
      grade: student.grade,
      school: student.school,
      learning_type: student.learning_type,
    });
    setIsModalOpen(true);
  };

  const handleDeleteStudent = async (id: string) => {
    if (confirm("Xác nhận xóa học viên này?")) {
      const updated = students.filter(s => s.id !== id);
      setStudents(updated);
      await saveStudents(updated);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingStudent) {
      // Edit
      const updated = students.map(s =>
        s.id === editingStudent.id
          ? { ...s, ...formData }
          : s
      );
      setStudents(updated);
      await saveStudents(updated);
    } else {
      // Add
      const newId = `s${students.length + 1}-${Math.floor(Math.random() * 1000)}`;
      const newStudent: Student = {
        id: newId,
        user_id: `u${students.length + 1}-${Math.floor(Math.random() * 1000)}`,
        full_name: formData.full_name,
        email: formData.email,
        dob: formData.dob,
        grade: formData.grade,
        school: formData.school,
        learning_type: formData.learning_type,
        created_at: new Date().toISOString().split("T")[0],
      } as any;
      const updated = [...students, newStudent];
      setStudents(updated);
      await saveStudents(updated);
    }
    setIsModalOpen(false);
  };

  const filtered = students.filter(s => {
    const matchesSearch =
      s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      s.school.toLowerCase().includes(search.toLowerCase());
    const matchesMode =
      filterMode === "All" ||
      s.learning_type.toLowerCase() === filterMode.toLowerCase();
    return matchesSearch && matchesMode;
  });

  return (
    <PortalLayout role="admin" userName="Admin User" pageTitle="Quản lý Học viên">
      <div className="space-y-6">
        <SectionHeader
          title="Danh sách Học viên"
          subtitle={`Tổng cộng ${students.length} học viên đã đăng ký`}
          action={
            <Button variant="gradient" onClick={handleOpenAddModal}>
              <Plus className="h-4 w-4 mr-1" /> Thêm học viên
            </Button>
          }
        />

        {/* Filters */}
        <div className="flex flex-col gap-3">
          <Input
            placeholder="Tìm học viên..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
            className="w-full sm:w-72 bg-card"
          />
          <div className="flex items-center gap-2 flex-wrap">
            {(["All", "Online", "Offline", "Hybrid"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilterMode(f)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                  filterMode === f
                    ? "bg-rose-500 text-white shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                {{ All: "Tất cả", Online: "Trực tuyến", Offline: "Tại lớp", Hybrid: "Kết hợp" }[f]}
              </button>
            ))}
          </div>
        </div>

        {/* Student table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    {["Học viên", "Lớp & Trường", "Hình thức", "Chuyên cần", "Học phí", "Thao tác", ""].map(h => (
                      <th key={h} className="text-left p-4 text-xs font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground text-sm">
                        Không tìm thấy học viên nào.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((student, i) => {
                      // Ưu tiên payment pending/overdue, fallback về mới nhất
                      const studentPayments = payments.filter(p => p.student_id === student.id);
                      const payment = studentPayments.find(p => p.payment_status === "overdue")
                        ?? studentPayments.find(p => p.payment_status === "pending")
                        ?? studentPayments[studentPayments.length - 1];
                      const attRecords = attendance.filter(a => a.student_id === student.id);
                      const presentCount = attRecords.filter(a => a.status === "present").length;
                      const attRate = attRecords.length > 0 ? Math.round((presentCount / attRecords.length) * 100) : null;

                      return (
                        <tr key={student.id} className="hover:bg-muted/30 transition-colors animate-fade-in" style={{ animationDelay: `${i * 30}ms` }}>
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <Avatar size="sm"><AvatarFallback name={student.full_name} /></Avatar>
                              <div>
                                <p className="text-sm font-semibold text-foreground">{student.full_name}</p>
                                <p className="text-[11px] text-muted-foreground">{(student as any).email || `ID: ${student.id}`}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <p className="text-sm text-foreground">{student.grade}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[160px]">{student.school}</p>
                          </td>
                          <td className="p-4"><LearningModeBadge mode={student.learning_type} /></td>
                          <td className="p-4 w-32">
                            {attRate !== null
                              ? <ProgressBar value={attRate} size="sm" />
                              : <span className="text-xs text-muted-foreground">—</span>}
                          </td>
                          <td className="p-4">
                            {payment ? (
                              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                payment.payment_status === "paid" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                                payment.payment_status === "overdue" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                                "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                              }`}>
                                {{ paid: "Đã thu", pending: "Chờ thu", overdue: "Quá hạn" }[payment.payment_status as string] ?? payment.payment_status}
                              </span>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <Button size="sm" variant="outline" onClick={() => handleOpenEditModal(student)}>
                                <Edit className="h-3 w-3 mr-1" /> Sửa
                              </Button>
                              <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10" onClick={() => handleDeleteStudent(student.id)}>
                                <Trash2 className="h-3 w-3 mr-1" /> Xóa
                              </Button>
                            </div>
                          </td>
                          <td className="p-4">
                            <Link
                              href={`/admin/classes?student=${student.id}`}
                              className="text-xs text-rose-500 hover:text-rose-600 font-semibold flex items-center gap-1 transition-colors whitespace-nowrap"
                            >
                              <ExternalLink className="h-3 w-3" /> Xem lớp
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-border w-full max-w-md rounded-2xl p-6 shadow-2xl relative animate-scale-up">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
            <h3 className="text-lg font-bold text-foreground mb-4">
              {editingStudent ? "Chỉnh sửa Học viên" : "Thêm Học viên mới"}
            </h3>
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Họ và tên *</label>
                <Input
                  required
                  value={formData.full_name}
                  onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="VD: Nguyễn Văn A"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Email liên hệ</label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="VD: hocvien@gmail.com"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Ngày sinh</label>
                  <Input
                    type="date"
                    value={formData.dob}
                    onChange={e => setFormData({ ...formData, dob: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Lớp *</label>
                  <select
                    className="flex h-10 w-full items-center justify-between rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    value={formData.grade}
                    onChange={e => setFormData({ ...formData, grade: e.target.value })}
                  >
                    {["Lớp 6", "Lớp 7", "Lớp 8", "Lớp 9", "Lớp 10", "Lớp 11", "Lớp 12"].map(g => (
                      <option key={g} value={g} className="text-foreground">{g}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Trường học</label>
                <Input
                  value={formData.school}
                  onChange={e => setFormData({ ...formData, school: e.target.value })}
                  placeholder="VD: THPT Chu Văn An"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Hình thức học *</label>
                <select
                  className="flex h-10 w-full items-center justify-between rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  value={formData.learning_type}
                  onChange={e => setFormData({ ...formData, learning_type: e.target.value as any })}
                >
                  <option value="online">Trực tuyến</option>
                  <option value="offline">Tại lớp</option>
                  <option value="hybrid">Kết hợp</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                  Hủy
                </Button>
                <Button type="submit" variant="gradient">
                  {editingStudent ? "Lưu thay đổi" : "Thêm mới"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}
