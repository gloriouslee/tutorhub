"use client";

import { useState, useEffect, useRef } from "react";
import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/shared";
import { getStudentAccounts, changeStudentPassword, type StudentAccount } from "@/lib/storage";
import { useStudentContext } from "@/hooks/useStudentContext";
import { createClient } from "@/lib/supabase/client";
import {
  User, Mail, Phone, BookOpen, Shield, Key, Camera,
  GraduationCap, Calendar, CheckCircle2, Save, RotateCcw,
  AlertCircle, Eye, EyeOff,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────
interface ProfileData {
  full_name:    string;
  email:        string;
  dob:          string;
  school:       string;
  grade:        string;
  phone:        string;
  student_id:   string;
  username?:    string;
}

function buildProfile(
  account: StudentAccount | null,
  studentId: string,
  studentName: string,
): ProfileData {
  if (account) {
    return {
      full_name:       account.full_name,
      email:           account.email,
      dob:             account.dob,
      school:          account.school,
      grade:           account.grade,
      phone:            account.phone,
      student_id:      account.student_id,
      username:        account.username,
    };
  }
  return {
    full_name:       studentName,
    email:           "",
    dob:             "",
    school:          "",
    grade:           "",
    phone:           "",
    student_id:      studentId,
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function StudentProfilePage() {
  const { studentId, studentName, myClasses: enrolledClasses } = useStudentContext();
  const [account, setAccount] = useState<StudentAccount | null>(null);
  const [loaded,  setLoaded]  = useState(false);

  // Form state
  const [form,    setForm]    = useState<ProfileData | null>(null);
  const [dirty,   setDirty]   = useState(false);
  const [saved,   setSaved]   = useState(false);

  // Password state
  const [curPwd,  setCurPwd]  = useState("");
  const [newPwd,  setNewPwd]  = useState("");
  const [confPwd, setConfPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [pwdMsg,  setPwdMsg]  = useState<{ ok: boolean; text: string } | null>(null);

  // Avatar
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const accounts = await getStudentAccounts();
      const acc = accounts.find(a => a.student_id === studentId) ?? null;
      setAccount(acc);
      setForm(buildProfile(acc, studentId, studentName));
      try {
        setAvatarUrl(localStorage.getItem(`tutorhub_avatar_${studentId}`));
      } catch { /* ignore */ }
      setLoaded(true);
    })();
  }, [studentId, studentName]);

  if (!loaded || !form) return null;

  const base = buildProfile(account, studentId, studentName);


  const initials = form.full_name
    .split(" ")
    .map(n => n[0])
    .join("")
    .slice(-2)
    .toUpperCase();

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleChange(field: keyof ProfileData, value: string) {
    setForm(prev => prev ? { ...prev, [field]: value } : prev);
    setDirty(true);
    setSaved(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const response = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: form.full_name,
        dob: form.dob,
        school: form.school,
        grade: form.grade,
        phone: form.phone,
      }),
    });
    if (!response.ok) {
      setSaved(false);
      return;
    }
    setDirty(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function handleReset() {
    setForm(base);
    setDirty(false);
    setSaved(false);
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (!curPwd) { setPwdMsg({ ok: false, text: "Vui lòng nhập mật khẩu hiện tại." }); return; }
    if (
      newPwd.length < 12 ||
      !/[a-z]/.test(newPwd) ||
      !/[A-Z]/.test(newPwd) ||
      !/[0-9]/.test(newPwd) ||
      !/[^A-Za-z0-9]/.test(newPwd)
    ) {
      setPwdMsg({ ok: false, text: "Mật khẩu cần ít nhất 12 ký tự, gồm chữ hoa, chữ thường, số và ký hiệu." });
      return;
    }
    if (newPwd !== confPwd) { setPwdMsg({ ok: false, text: "Mật khẩu xác nhận không khớp." }); return; }
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user?.email) {
      setPwdMsg({ ok: false, text: "Phiên đăng nhập không hợp lệ." });
      return;
    }
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: userData.user.email,
      password: curPwd,
    });
    if (verifyError) {
      setPwdMsg({ ok: false, text: "Mật khẩu hiện tại không đúng." });
      return;
    }
    const result = await changeStudentPassword(studentId, curPwd, newPwd);
    if (result === "wrong_password") {
      setPwdMsg({ ok: false, text: "Mật khẩu hiện tại không đúng." });
      return;
    }
    if (result === "not_found") {
      setPwdMsg({ ok: false, text: "Không tìm thấy tài khoản để đổi mật khẩu." });
      return;
    }
    setPwdMsg({ ok: true, text: "Đổi mật khẩu thành công!" });
    setCurPwd(""); setNewPwd(""); setConfPwd("");
    setTimeout(() => setPwdMsg(null), 4000);
  }

  async function handleAvatarPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Hiển thị ngay bằng blob tạm, upload lên bucket avatars phía sau
    setAvatarUrl(URL.createObjectURL(file));
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "png";
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const path = `${userData.user.id}/${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error || !data) return;
      const { data: signed } = await supabase.storage
        .from("avatars")
        .createSignedUrl(data.path, 60 * 60);
      if (!signed?.signedUrl) return;
      setAvatarUrl(signed.signedUrl);
    } catch { /* offline — giữ blob tạm cho phiên hiện tại */ }
  }

  return (
    <PortalLayout role="student" userName={form.full_name} pageTitle="Hồ sơ cá nhân">
      <div className="space-y-6 max-w-5xl mx-auto">
        <SectionHeader
          title="Thông tin tài khoản"
          subtitle="Quản lý thông tin cá nhân và cài đặt bảo mật"
        />

        {/* Save success toast */}
        {saved && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/50 animate-fade-in">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Đã lưu thông tin thành công!</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Left column ───────────────────────────────── */}
          <div className="space-y-5">

            {/* Avatar card */}
            <Card className="overflow-hidden border-border/50 shadow-sm">
              <div className="h-24 bg-gradient-to-r from-primary/80 to-primary" />
              <CardContent className="p-6 pt-0 flex flex-col items-center text-center relative">
                <div
                  className="relative -mt-12 mb-4 cursor-pointer group transition-transform hover:scale-105"
                  onClick={() => fileRef.current?.click()}
                >
                  <Avatar className="h-24 w-24 border-4 border-card shadow-sm">
                    {avatarUrl
                      ? <img src={avatarUrl} alt={form.full_name} className="h-full w-full object-cover rounded-full" />
                      : <AvatarFallback className="text-2xl bg-primary/10 text-primary font-bold">{initials}</AvatarFallback>}
                  </Avatar>
                  <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="h-6 w-6 text-white" />
                  </div>
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarPick} />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors mb-3"
                >
                  Đổi ảnh đại diện
                </button>

                <h2 className="text-xl font-bold text-foreground mb-1">{form.full_name}</h2>
                <p className="text-sm text-muted-foreground mb-4">{form.grade} · {form.school}</p>

                <div className="w-full space-y-2">
                  <div className="flex items-center justify-between text-sm p-3 bg-muted/40 rounded-xl">
                    <span className="text-muted-foreground flex items-center gap-2"><Shield className="h-4 w-4" />ID</span>
                    <span className="font-semibold text-foreground font-mono text-xs">{form.student_id.toUpperCase()}</span>
                  </div>
                  {form.username && (
                    <div className="flex items-center justify-between text-sm p-3 bg-muted/40 rounded-xl">
                      <span className="text-muted-foreground flex items-center gap-2"><Mail className="h-4 w-4" />Tài khoản</span>
                      <span className="font-semibold text-foreground text-xs truncate max-w-[120px]">{form.username}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Enrolled classes */}
            {enrolledClasses.length > 0 && (
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-3 border-b border-border/50">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-primary" /> Lớp đang theo học
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-2">
                  {enrolledClasses.map(cls => {
                    return (
                      <div key={cls.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl border border-border/50">
                        <div className="h-3 w-3 rounded-full shrink-0" style={{ background: cls.color }} />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{cls.class_name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {cls.subject}
                            {cls.tutor_id && ` · ${cls.tutor_id}`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Change password */}
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Key className="h-4 w-4 text-primary" /> Đổi mật khẩu
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <form onSubmit={handlePasswordChange} className="space-y-3">
                  {[
                    { label: "Mật khẩu hiện tại", value: curPwd, set: setCurPwd },
                    { label: "Mật khẩu mới",       value: newPwd, set: setNewPwd },
                    { label: "Xác nhận mật khẩu",  value: confPwd, set: setConfPwd },
                  ].map(field => (
                    <div key={field.label} className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">{field.label}</label>
                      <div className="relative">
                        <Input
                          type={showPwd ? "text" : "password"}
                          placeholder="••••••••"
                          value={field.value}
                          onChange={e => { field.set(e.target.value); setPwdMsg(null); }}
                          className="pr-9"
                        />
                        <button
                          type="button"
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowPwd(v => !v)}
                        >
                          {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  ))}

                  {pwdMsg && (
                    <div className={`flex items-center gap-2 text-xs p-2.5 rounded-lg ${pwdMsg.ok ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"}`}>
                      {pwdMsg.ok ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <AlertCircle className="h-3.5 w-3.5 shrink-0" />}
                      {pwdMsg.text}
                    </div>
                  )}

                  <Button type="submit" className="w-full" variant="outline">
                    <Key className="h-3.5 w-3.5 mr-1.5" /> Cập nhật mật khẩu
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* ── Right: detail form ────────────────────────── */}
          <div className="lg:col-span-2">
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-4 border-b border-border/50">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Chi tiết Thông tin</CardTitle>
                  <div className="flex items-center gap-2">
                    {dirty && (
                      <Badge variant="warning" className="text-[10px]">Chưa lưu</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <form className="space-y-6" onSubmit={handleSave}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" /> Họ và tên
                      </label>
                      <Input
                        value={form.full_name}
                        onChange={e => handleChange("full_name", e.target.value)}
                        className="bg-muted/30"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" /> Ngày sinh
                      </label>
                      <Input
                        type="date"
                        value={form.dob}
                        onChange={e => handleChange("dob", e.target.value)}
                        className="bg-muted/30"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" /> Email
                      </label>
                      <Input
                        type="email"
                        value={form.email}
                        onChange={e => handleChange("email", e.target.value)}
                        className="bg-muted/30"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" /> SĐT liên hệ
                      </label>
                      <Input
                        type="tel"
                        value={form.phone}
                        onChange={e => handleChange("phone", e.target.value)}
                        className="bg-muted/30"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <GraduationCap className="h-4 w-4 text-muted-foreground" /> Khối lớp
                      </label>
                      <Input
                        value={form.grade}
                        onChange={e => handleChange("grade", e.target.value)}
                        className="bg-muted/30"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-muted-foreground" /> Trường học
                      </label>
                      <Input
                        value={form.school}
                        onChange={e => handleChange("school", e.target.value)}
                        className="bg-muted/30"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border flex justify-end gap-3">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleReset}
                      disabled={!dirty}
                      className="gap-2"
                    >
                      <RotateCcw className="h-4 w-4" /> Hủy thay đổi
                    </Button>
                    <Button
                      type="submit"
                      variant="gradient"
                      className="px-8 gap-2"
                      disabled={!dirty}
                    >
                      <Save className="h-4 w-4" /> Lưu thông tin
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
