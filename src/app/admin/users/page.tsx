"use client";

import { useState, useEffect, useMemo, useRef, useLayoutEffect } from "react";
import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Search, Plus, X, Edit2, Trash2, KeyRound,
  ShieldCheck, GraduationCap, BookOpen, UserX, UserCheck,
  Eye, EyeOff, Shield, Users,
} from "lucide-react";
import {
  getManagedUsers, saveManagedUser, deleteManagedUser, kvSet,
  resetManagedUserPassword, toggleManagedUserDisabled,
  getStudentAccounts,
  type ManagedUser, type UserRole,
} from "@/lib/storage";
import { MOCK_TEACHERS, MOCK_STUDENTS } from "@/lib/mock-data";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_META: Record<UserRole, { label: string; color: string; icon: React.ElementType }> = {
  student: { label: "Học viên",      color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300", icon: GraduationCap },
  teacher: { label: "Giáo viên",     color: "bg-amber-100  text-amber-700  dark:bg-amber-900/30  dark:text-amber-300",  icon: BookOpen },
  admin:   { label: "Quản trị viên", color: "bg-rose-100   text-rose-700   dark:bg-rose-900/30   dark:text-rose-300",   icon: ShieldCheck },
};

const TABS = [
  { id: "all"     as const, label: "Tất cả",         icon: Users,         dot: "bg-foreground/40" },
  { id: "student" as const, label: "Học viên",       icon: GraduationCap, dot: "bg-indigo-500" },
  { id: "teacher" as const, label: "Giáo viên",      icon: BookOpen,      dot: "bg-amber-500" },
  { id: "admin"   as const, label: "Quản trị viên",  icon: ShieldCheck,   dot: "bg-rose-500" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Seed: merge localStorage + existing data into ManagedUsers on first load
// ─────────────────────────────────────────────────────────────────────────────

async function seedIfNeeded(existing: ManagedUser[]): Promise<ManagedUser[]> {
  const existingIds = new Set(existing.map(u => u.id));
  const seeded: ManagedUser[] = [...existing];

  // Seed admin
  if (!existingIds.has("admin_demo")) {
    seeded.push({
      id: "admin_demo", type: "admin",
      full_name: "Demo Admin", username: "admin",
      email: "admin@tutorhub.edu.vn", password: "admin123",
      disabled: false, created_at: new Date().toISOString(),
    });
  }

  // Seed teachers: localStorage first, fallback to MOCK_TEACHERS
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem("tutorhub_teachers") : null;
    const teachers: typeof MOCK_TEACHERS = raw ? JSON.parse(raw) : MOCK_TEACHERS;
    for (const t of teachers) {
      const id = `teacher_${t.id}`;
      if (!existingIds.has(id)) {
        const name = t.full_name ?? "Giáo viên";
        const slug = name.toLowerCase().replace(/[àáâãäå]/g,"a").replace(/[èéêë]/g,"e").replace(/[ìíîï]/g,"i").replace(/[òóôõö]/g,"o").replace(/[ùúûü]/g,"u").replace(/[ý]/g,"y").replace(/[^a-z0-9\s]/g,"").replace(/\s+/g,".");
        seeded.push({
          id, type: "teacher",
          full_name: name,
          username: slug,
          email: `${slug}@tutorhub.edu.vn`,
          password: "teacher123",
          disabled: false, created_at: t.created_at ?? new Date().toISOString(),
          specialization: t.specialization,
        });
        existingIds.add(id);
      }
    }
  } catch { /* ignore */ }

  // Seed enrolled student accounts; also seed MOCK_STUDENTS as base
  try {
    const accounts = typeof window !== "undefined" ? await getStudentAccounts() : [];
    for (const a of accounts) {
      const id = `account_${a.student_id}`;
      if (!existingIds.has(id)) {
        seeded.push({
          id, type: "student",
          full_name: a.full_name,
          username: a.username,
          email: a.email,
          password: "student123",
          disabled: false, created_at: a.created_at,
          grade: a.grade, school: a.school,
        });
        existingIds.add(id);
      }
    }
    // Also seed from MOCK_STUDENTS
    for (const s of MOCK_STUDENTS) {
      const id = `student_${s.id}`;
      if (!existingIds.has(id)) {
        const name = s.full_name ?? "";
        const slug = name.toLowerCase().replace(/[àáâãäå]/g,"a").replace(/[èéêë]/g,"e").replace(/[ìíîï]/g,"i").replace(/[òóôõö]/g,"o").replace(/[ùúûü]/g,"u").replace(/[ý]/g,"y").replace(/[^a-z0-9\s]/g,"").replace(/\s+/g,".");
        seeded.push({
          id, type: "student",
          full_name: name,
          username: slug,
          email: `${slug}@student.tutorhub.edu.vn`,
          password: "student123",
          disabled: false, created_at: new Date().toISOString(),
          grade: s.grade, school: s.school,
        });
        existingIds.add(id);
      }
    }
  } catch { /* ignore */ }

  return seeded;
}

// ─────────────────────────────────────────────────────────────────────────────
// Edit Modal
// ─────────────────────────────────────────────────────────────────────────────

function EditModal({
  user, onSave, onClose,
}: { user: ManagedUser | null; onClose: () => void; onSave: (u: ManagedUser) => void }) {
  const isNew = !user;
  const [form, setForm] = useState<Omit<ManagedUser, "id" | "disabled" | "created_at">>({
    type: "student", full_name: "", username: "", email: "", password: "",
  });

  useEffect(() => {
    if (user) setForm({ type: user.type, full_name: user.full_name, username: user.username, email: user.email ?? "", password: user.password ?? "", grade: user.grade, school: user.school, specialization: user.specialization });
    else setForm({ type: "student", full_name: "", username: "", email: "", password: "" });
  }, [user]);

  function handleSave() {
    if (!form.full_name.trim() || !form.username.trim()) return;
    const saved: ManagedUser = {
      id: user?.id ?? `usr_${crypto.randomUUID().slice(0, 8)}`,
      disabled: user?.disabled ?? false,
      created_at: user?.created_at ?? new Date().toISOString(),
      ...form,
    };
    onSave(saved);
    onClose();
  }

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground">{isNew ? "Thêm người dùng" : "Chỉnh sửa tài khoản"}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          {/* Role selector */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Vai trò</label>
            <div className="flex gap-2">
              {(["student", "teacher", "admin"] as UserRole[]).map(r => (
                <button
                  key={r}
                  onClick={() => set("type", r)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${form.type === r ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}
                >
                  {ROLE_META[r].label}
                </button>
              ))}
            </div>
          </div>
          <Field label="Họ tên" value={form.full_name} onChange={v => set("full_name", v)} placeholder="Nguyễn Văn A" />
          <Field label="Tên đăng nhập" value={form.username} onChange={v => set("username", v)} placeholder="nguyen.van.a" />
          <Field label="Email" value={form.email ?? ""} onChange={v => set("email", v)} placeholder="email@example.com" type="email" />
          {isNew && (
            <Field label="Mật khẩu ban đầu" value={form.password ?? ""} onChange={v => set("password", v)} placeholder="Tối thiểu 6 ký tự" type="password" />
          )}
          {form.type === "student" && (
            <>
              <Field label="Lớp" value={form.grade ?? ""} onChange={v => set("grade", v)} placeholder="Lớp 12" />
              <Field label="Trường" value={form.school ?? ""} onChange={v => set("school", v)} placeholder="THPT Nguyễn Thị Minh Khai" />
            </>
          )}
          {form.type === "teacher" && (
            <Field label="Chuyên môn" value={form.specialization ?? ""} onChange={v => set("specialization", v)} placeholder="Toán học" />
          )}
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <Button variant="outline" className="flex-1" onClick={onClose}>Huỷ</Button>
          <Button className="flex-1" onClick={handleSave} disabled={!form.full_name.trim() || !form.username.trim()}>
            {isNew ? "Tạo tài khoản" : "Lưu thay đổi"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground block mb-1.5">{label}</label>
      <Input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="h-9 text-sm" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reset Password Modal
// ─────────────────────────────────────────────────────────────────────────────

function PasswordModal({ user, onClose, onSave }: { user: ManagedUser; onClose: () => void; onSave: (pwd: string) => void }) {
  const [pwd, setPwd]     = useState("");
  const [confirm, setCfm] = useState("");
  const [show, setShow]   = useState(false);
  const mismatch = confirm && pwd !== confirm;
  const valid    = pwd.length >= 6 && pwd === confirm;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <p className="font-semibold text-sm text-foreground">Đặt lại mật khẩu</p>
            <p className="text-xs text-muted-foreground">{user.full_name} · @{user.username}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Mật khẩu mới</label>
            <div className="relative">
              <Input
                type={show ? "text" : "password"}
                value={pwd} onChange={e => setPwd(e.target.value)}
                placeholder="Tối thiểu 6 ký tự" className="h-9 text-sm pr-10"
              />
              <button type="button" onClick={() => setShow(s => !s)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Xác nhận mật khẩu</label>
            <Input
              type={show ? "text" : "password"}
              value={confirm} onChange={e => setCfm(e.target.value)}
              placeholder="Nhập lại mật khẩu" className={`h-9 text-sm ${mismatch ? "border-destructive focus:ring-destructive/40" : ""}`}
            />
            {mismatch && <p className="text-xs text-destructive mt-1">Mật khẩu không khớp</p>}
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <Button variant="outline" className="flex-1" onClick={onClose}>Huỷ</Button>
          <Button className="flex-1" disabled={!valid} onClick={() => { onSave(pwd); onClose(); }}>
            Xác nhận
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete Confirm
// ─────────────────────────────────────────────────────────────────────────────

function DeleteConfirm({ user, onClose, onConfirm }: { user: ManagedUser; onClose: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
            <Trash2 className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <p className="font-semibold text-foreground text-sm">Xoá tài khoản</p>
            <p className="text-xs text-muted-foreground">Hành động này không thể hoàn tác</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Bạn có chắc muốn xoá tài khoản của <span className="font-semibold text-foreground">{user.full_name}</span> (@{user.username})?
        </p>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Huỷ</Button>
          <Button variant="destructive" className="flex-1" onClick={() => { onConfirm(); onClose(); }}>Xoá</Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const [users, setUsers]         = useState<ManagedUser[]>([]);
  const [tab, setTab]             = useState<"all" | UserRole>("all");
  const [search, setSearch]       = useState("");
  const [editTarget, setEdit]     = useState<ManagedUser | null | undefined>(undefined); // undefined = closed, null = new
  const [pwdTarget, setPwd]       = useState<ManagedUser | null>(null);
  const [delTarget, setDel]       = useState<ManagedUser | null>(null);
  const [pwdVisible, setPwdVis]   = useState<Set<string>>(new Set());

  // Sliding pill indicator dưới tab đang chọn — đo vị trí nút active rồi animate transform
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useLayoutEffect(() => {
    const el = tabRefs.current[tab];
    if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
  }, [tab, users.length]);

  useEffect(() => {
    (async () => {
      const stored = await getManagedUsers();
      // Chỉ seed khi danh sách hoàn toàn trống — user đã xoá thì không bị thêm lại
      if (stored.length === 0) {
        const seeded = await seedIfNeeded([]);
        await kvSet("tutorhub_managed_users", seeded);
        setUsers(seeded);
      } else {
        setUsers(stored);
      }
    })();
  }, []);

  const reload = async () => setUsers(await getManagedUsers());

  const filtered = useMemo(() => {
    let list = users;
    if (tab !== "all") list = list.filter(u => u.type === tab);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(u =>
        u.full_name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [users, tab, search]);

  const counts: Record<string, number> = useMemo(() => ({
    all: users.length,
    student: users.filter(u => u.type === "student").length,
    teacher: users.filter(u => u.type === "teacher").length,
    admin:   users.filter(u => u.type === "admin").length,
  }), [users]);

  async function handleSaveUser(u: ManagedUser) {
    await saveManagedUser(u);
    await reload();
  }
  async function handleDelete(id: string) {
    await deleteManagedUser(id);
    await reload();
  }
  async function handleResetPwd(id: string, pwd: string) {
    await resetManagedUserPassword(id, pwd);
    await reload();
  }
  async function handleToggle(id: string) {
    await toggleManagedUserDisabled(id);
    await reload();
  }
  function togglePwdVisible(id: string) {
    setPwdVis(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <PortalLayout role="admin" userName="Admin User" pageTitle="Quản lý tài khoản">
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Quản lý tài khoản</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Quản lý người dùng, phân quyền và bảo mật tài khoản</p>
          </div>
          <Button onClick={() => setEdit(null)} className="gap-2">
            <Plus className="h-4 w-4" /> Thêm tài khoản
          </Button>
        </div>

        {/* Tabs + Search */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative flex gap-1 p-1 bg-muted/60 rounded-xl">
            {/* Pill nền trượt theo tab đang chọn */}
            <div
              data-testid="tab-indicator"
              className="absolute top-1 bottom-1 rounded-lg bg-card shadow-sm ring-1 ring-black/5 transition-all duration-300 ease-out"
              style={{ left: `${indicator.left}px`, width: `${indicator.width}px` }}
            />
            {TABS.map(t => {
              const active = tab === t.id;
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  ref={el => { tabRefs.current[t.id] = el; }}
                  onClick={() => setTab(t.id)}
                  className={`relative z-10 flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors duration-200 ${active ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Icon className={`h-3.5 w-3.5 transition-transform duration-300 ${active ? "scale-110" : ""}`} />
                  {t.label}
                  <span
                    className={`inline-flex items-center gap-1 ml-0.5 text-xs px-1.5 py-0.5 rounded-full transition-all duration-200 ${
                      active ? "bg-primary/10 text-primary" : "bg-border/70 text-muted-foreground"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
                    {counts[t.id]}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Tìm tên, username, email..."
              className="pl-8 h-9 text-sm"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* User list */}
        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="py-16 text-center text-sm text-muted-foreground border-2 border-dashed border-border rounded-2xl">
              Không tìm thấy tài khoản nào
            </div>
          )}
          {filtered.map((user, i) => {
            const rm = ROLE_META[user.type];
            const RoleIcon = rm.icon;
            const showPwd = pwdVisible.has(user.id);
            return (
              <Card
                key={user.id}
                className={`animate-fade-in transition-all duration-200 hover:shadow-md hover:border-primary/30 ${user.disabled ? "opacity-60" : ""}`}
                style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    {/* Avatar */}
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback name={user.full_name} />
                    </Avatar>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-foreground">{user.full_name}</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${rm.color}`}>
                          <RoleIcon className="h-3 w-3" /> {rm.label}
                        </span>
                        {user.disabled && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                            <UserX className="h-3 w-3" /> Đã khoá
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="text-xs text-muted-foreground">@{user.username}</span>
                        {user.email && <span className="text-xs text-muted-foreground">{user.email}</span>}
                        {user.grade && <span className="text-xs text-muted-foreground">{user.grade}</span>}
                        {user.specialization && <span className="text-xs text-muted-foreground">{user.specialization}</span>}
                      </div>
                    </div>

                    {/* Password display */}
                    {user.password && (
                      <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-muted/60 rounded-lg">
                        <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-mono text-muted-foreground">
                          {showPwd ? user.password : "•".repeat(Math.min(user.password.length, 8))}
                        </span>
                        <button onClick={() => togglePwdVisible(user.id)} className="ml-0.5 text-muted-foreground hover:text-foreground">
                          {showPwd ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </button>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setEdit(user)}
                        title="Chỉnh sửa"
                        className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setPwd(user)}
                        title="Đặt lại mật khẩu"
                        className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-amber-600 transition-colors"
                      >
                        <KeyRound className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleToggle(user.id)}
                        title={user.disabled ? "Mở khoá" : "Khoá tài khoản"}
                        className={`p-2 rounded-lg hover:bg-muted transition-colors ${user.disabled ? "text-emerald-600 hover:text-emerald-700" : "text-muted-foreground hover:text-orange-500"}`}
                      >
                        {user.disabled ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => setDel(user)}
                        title="Xoá tài khoản"
                        className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Modals */}
      {editTarget !== undefined && (
        <EditModal user={editTarget} onSave={handleSaveUser} onClose={() => setEdit(undefined)} />
      )}
      {pwdTarget && (
        <PasswordModal user={pwdTarget} onClose={() => setPwd(null)} onSave={pwd => handleResetPwd(pwdTarget.id, pwd)} />
      )}
      {delTarget && (
        <DeleteConfirm user={delTarget} onClose={() => setDel(null)} onConfirm={() => handleDelete(delTarget.id)} />
      )}
    </PortalLayout>
  );
}
