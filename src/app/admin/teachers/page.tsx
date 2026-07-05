"use client";

import { toLocalDateKey } from "@/lib/utils";

import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/shared";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Plus, X, Edit, Trash2, BookOpen, Users, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { getTeachers, saveTeachers, getClasses } from "@/lib/storage";
import { Teacher, Class } from "@/types";

export default function AdminTeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [search, setSearch] = useState("");
  const [filterSpec, setFilterSpec] = useState("All");

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    specialization: "Toán học",
    bio: "",
  });
  const [createAccount, setCreateAccount] = useState(true);
  const [accountPassword, setAccountPassword] = useState("");
  const [accountError, setAccountError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadData() {
      const [t, c] = await Promise.all([
        getTeachers(),
        getClasses(),
      ]);
      setTeachers(t);
      setClasses(c);
    }
    loadData();
  }, []);

  const handleOpenAddModal = () => {
    setEditingTeacher(null);
    setFormData({
      full_name: "",
      email: "",
      specialization: "Toán học",
      bio: "",
    });
    setCreateAccount(true);
    setAccountPassword("");
    setAccountError("");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setFormData({
      full_name: teacher.full_name,
      email: (teacher as any).email ?? "",
      specialization: teacher.specialization,
      bio: teacher.bio || "",
    });
    setIsModalOpen(true);
  };

  const handleDeleteTeacher = async (id: string) => {
    if (confirm("Xác nhận xóa giáo viên này?")) {
      const updated = teachers.filter(t => t.id !== id);
      setTeachers(updated);
      await saveTeachers(updated);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccountError("");
    if (editingTeacher) {
      // Edit
      const updated = teachers.map(t =>
        t.id === editingTeacher.id
          ? { ...t, ...formData }
          : t
      );
      setTeachers(updated);
      await saveTeachers(updated);
      setIsModalOpen(false);
      return;
    }

    // Add — tạo tài khoản đăng nhập trước (nếu bật) để lấy user_id thật
    const newId = `t${Date.now()}`;
    let authUserId: string | null = null;
    if (createAccount) {
      if (!formData.email) { setAccountError("Cần email để tạo tài khoản đăng nhập."); return; }
      if (accountPassword.length < 6) { setAccountError("Mật khẩu tối thiểu 6 ký tự."); return; }
      setSubmitting(true);
      try {
        const res = await fetch("/api/admin/create-account", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: formData.email,
            password: accountPassword,
            full_name: formData.full_name,
            role: "teacher",
            record_id: newId,
          }),
        });
        const body = await res.json();
        if (!res.ok) {
          setAccountError(body.error ?? "Không tạo được tài khoản.");
          setSubmitting(false);
          return;
        }
        authUserId = body.user_id;
      } catch {
        setAccountError("Không kết nối được máy chủ để tạo tài khoản.");
        setSubmitting(false);
        return;
      }
    }

    const newTeacher: Teacher = {
      id: newId,
      user_id: authUserId,
      full_name: formData.full_name,
      email: formData.email,
      specialization: formData.specialization,
      bio: formData.bio,
      created_at: toLocalDateKey(new Date()),
    } as any;
    const updated = [...teachers, newTeacher];
    setTeachers(updated);
    await saveTeachers(updated);
    setSubmitting(false);
    setIsModalOpen(false);
  };

  const uniqueSpecs = Array.from(new Set(teachers.map(t => t.specialization)));

  const filtered = teachers.filter(t => {
    const matchesSearch =
      t.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (t.specialization && t.specialization.toLowerCase().includes(search.toLowerCase()));
    const matchesSpec =
      filterSpec === "All" ||
      t.specialization === filterSpec;
    return matchesSearch && matchesSpec;
  });

  return (
    <PortalLayout role="admin" userName="Admin User" pageTitle="Giáo viên">
      <div className="space-y-6">
        <SectionHeader
          title="Danh sách Giáo viên"
          subtitle={`Tổng cộng ${teachers.length} giáo viên đang hoạt động`}
          action={
            <Button variant="gradient" onClick={handleOpenAddModal}>
              <Plus className="h-4 w-4 mr-1" /> Thêm giáo viên
            </Button>
          }
        />

        {/* Filters */}
        <div className="flex flex-col gap-3">
          <Input
            placeholder="Tìm giáo viên..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
            className="w-full sm:w-72 bg-card"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setFilterSpec("All")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                filterSpec === "All"
                  ? "bg-rose-500 text-white shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              Tất cả
            </button>
            {uniqueSpecs.map(spec => (
              <button
                key={spec}
                onClick={() => setFilterSpec(spec)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                  filterSpec === spec
                    ? "bg-rose-500 text-white shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                {spec}
              </button>
            ))}
          </div>
        </div>

        {/* Grid cards of teachers */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.length === 0 ? (
            <div className="col-span-full py-12 text-center text-muted-foreground text-sm">
              Không tìm thấy giáo viên nào.
            </div>
          ) : (
            filtered.map((t, i) => {
              const teacherClasses = classes.filter(c => c.tutor_id === t.id);
              const studentCount = teacherClasses.reduce(
                (sum, c) => sum + ((c as any).student_ids?.length ?? 0), 0
              );
              return (
                <Card key={t.id} className="animate-fade-in hover:shadow-lg transition-all border border-border" style={{ animationDelay: `${i * 30}ms` }}>
                  <CardContent className="p-5 flex flex-col h-full justify-between gap-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar size="md">
                            <AvatarFallback name={t.full_name} />
                          </Avatar>
                          <div>
                            <h4 className="text-sm font-bold text-foreground">{t.full_name}</h4>
                            <p className="text-xs text-rose-500 font-semibold">{t.specialization}</p>
                          </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground">ID: {t.id}</span>
                      </div>

                      <p className="text-xs text-muted-foreground line-clamp-3 min-h-[48px]">
                        {t.bio || "Chưa có thông tin giới thiệu."}
                      </p>

                      <div className="flex items-center gap-4">
                        <span className="text-xs text-muted-foreground flex items-center gap-1 font-semibold">
                          <BookOpen className="h-3.5 w-3.5 text-rose-400" />
                          {teacherClasses.length} lớp
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1 font-semibold">
                          <Users className="h-3.5 w-3.5 text-rose-400" />
                          {studentCount} học viên
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-border pt-3.5 flex items-center justify-between">
                      <Link
                        href={`/admin/classes?teacher=${t.id}`}
                        className="text-xs text-rose-500 hover:text-rose-600 font-semibold flex items-center gap-1 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" /> Xem lớp
                      </Link>
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="outline" className="h-8 py-0" onClick={() => handleOpenEditModal(t)}>
                          <Edit className="h-3 w-3 mr-1" /> Sửa
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 py-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10" onClick={() => handleDeleteTeacher(t.id)}>
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
          <div className="bg-card border border-border w-full max-w-md rounded-2xl p-6 shadow-2xl relative animate-scale-up">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
            <h3 className="text-lg font-bold text-foreground mb-4">
              {editingTeacher ? "Chỉnh sửa Giáo viên" : "Thêm Giáo viên mới"}
            </h3>
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Họ và tên *</label>
                <Input
                  required
                  value={formData.full_name}
                  onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="VD: Thầy Hùng Toán"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Email liên hệ</label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="VD: giaovien@tutorhub.vn"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Chuyên môn *</label>
                <Input
                  required
                  value={formData.specialization}
                  onChange={e => setFormData({ ...formData, specialization: e.target.value })}
                  placeholder="VD: Toán Đại Số & Luyện Thi"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Tiểu sử / Giới thiệu</label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground text-foreground"
                  value={formData.bio}
                  onChange={e => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="Kinh nghiệm giảng dạy, phong cách dạy..."
                />
              </div>
              {!editingTeacher && (
                <div className="space-y-3 border-t border-border pt-4">
                  <label className="flex items-center gap-2 text-sm font-medium text-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createAccount}
                      onChange={e => setCreateAccount(e.target.checked)}
                      className="h-4 w-4 rounded border-input accent-primary"
                    />
                    Tạo tài khoản đăng nhập cho giáo viên
                  </label>
                  {createAccount && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Mật khẩu ban đầu *</label>
                      <Input
                        type="text"
                        value={accountPassword}
                        onChange={e => setAccountPassword(e.target.value)}
                        placeholder="Tối thiểu 6 ký tự"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Đăng nhập bằng email liên hệ ở trên + mật khẩu này.
                      </p>
                    </div>
                  )}
                  {accountError && (
                    <p className="text-xs text-red-500 font-medium">{accountError}</p>
                  )}
                </div>
              )}
              <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                  Hủy
                </Button>
                <Button type="submit" variant="gradient" disabled={submitting}>
                  {submitting ? "Đang tạo..." : editingTeacher ? "Lưu thay đổi" : "Thêm mới"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}
