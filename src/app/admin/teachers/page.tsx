"use client";

import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/shared";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Plus, X, Edit, Trash2, BookOpen } from "lucide-react";
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
    specialization: "Toán học",
    bio: "",
  });

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
      specialization: "Toán học",
      bio: "",
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setFormData({
      full_name: teacher.full_name,
      specialization: teacher.specialization,
      bio: teacher.bio || "",
    });
    setIsModalOpen(true);
  };

  const handleDeleteTeacher = async (id: string) => {
    if (confirm("Are you sure you want to delete this teacher?")) {
      const updated = teachers.filter(t => t.id !== id);
      setTeachers(updated);
      await saveTeachers(updated);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTeacher) {
      // Edit
      const updated = teachers.map(t =>
        t.id === editingTeacher.id
          ? { ...t, ...formData }
          : t
      );
      setTeachers(updated);
      await saveTeachers(updated);
    } else {
      // Add
      const newId = `t${teachers.length + 1}-${Math.floor(Math.random() * 1000)}`;
      const newTeacher: Teacher = {
        id: newId,
        user_id: `tu${teachers.length + 1}-${Math.floor(Math.random() * 1000)}`,
        full_name: formData.full_name,
        specialization: formData.specialization,
        bio: formData.bio,
        created_at: new Date().toISOString().split("T")[0],
      };
      const updated = [...teachers, newTeacher];
      setTeachers(updated);
      await saveTeachers(updated);
    }
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
          title="All Teachers"
          subtitle={`${teachers.length} professional tutors active`}
          action={
            <Button variant="gradient" onClick={handleOpenAddModal}>
              <Plus className="h-4 w-4 mr-1" /> Add Teacher
            </Button>
          }
        />

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <Input
            placeholder="Search teachers..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
            className="w-64 bg-card"
          />
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => setFilterSpec("All")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                filterSpec === "All"
                  ? "bg-rose-500 text-white shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              All
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
              No teachers found.
            </div>
          ) : (
            filtered.map((t, i) => {
              const teacherClasses = classes.filter(c => c.tutor_id === t.id);
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
                        {t.bio || "No biography provided yet."}
                      </p>
                    </div>

                    <div className="border-t border-border pt-3.5 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1 font-semibold">
                        <BookOpen className="h-3.5 w-3.5 text-rose-400" />
                        {teacherClasses.length} classes
                      </span>
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="outline" className="h-8 py-0" onClick={() => handleOpenEditModal(t)}>
                          <Edit className="h-3 w-3 mr-1" /> Edit
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 py-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10" onClick={() => handleDeleteTeacher(t.id)}>
                          <Trash2 className="h-3 w-3 mr-1" /> Delete
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
              <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                  Hủy
                </Button>
                <Button type="submit" variant="gradient">
                  {editingTeacher ? "Lưu thay đổi" : "Thêm mới"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}
