"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MOCK_CLASSES } from "@/lib/mock-data";
import { createEnrollment } from "@/lib/storage";
import {
  GraduationCap, User, Mail, Phone, BookOpen,
  Calendar, FileText, CheckCircle2, ArrowLeft, ChevronRight,
} from "lucide-react";

const GRADES = ["Lớp 6", "Lớp 7", "Lớp 8", "Lớp 9", "Lớp 10", "Lớp 11", "Lớp 12"];

interface FormData {
  full_name: string;
  email: string;
  dob: string;
  school: string;
  grade: string;
  requested_class_id: string;
  parent_phone: string;
  note: string;
}

const EMPTY: FormData = {
  full_name: "", email: "", dob: "", school: "",
  grade: "", requested_class_id: "", parent_phone: "", note: "",
};

type FieldError = Partial<Record<keyof FormData, string>>;

function validate(f: FormData): FieldError {
  const errs: FieldError = {};
  if (!f.full_name.trim())         errs.full_name         = "Vui lòng nhập họ tên";
  if (!f.email.trim())             errs.email             = "Vui lòng nhập email";
  else if (!/\S+@\S+\.\S+/.test(f.email)) errs.email     = "Email không hợp lệ";
  if (!f.dob)                      errs.dob               = "Vui lòng chọn ngày sinh";
  if (!f.school.trim())            errs.school            = "Vui lòng nhập tên trường";
  if (!f.grade)                    errs.grade             = "Vui lòng chọn khối lớp";
  if (!f.requested_class_id)       errs.requested_class_id = "Vui lòng chọn lớp";
  if (!f.parent_phone.trim())      errs.parent_phone      = "Vui lòng nhập SĐT phụ huynh";
  return errs;
}

export default function EnrollPage() {
  const [form, setForm]       = useState<FormData>(EMPTY);
  const [errors, setErrors]   = useState<FieldError>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const set = (key: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [key]: e.target.value }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 600));
    createEnrollment({
      full_name:          form.full_name.trim(),
      email:              form.email.trim().toLowerCase(),
      dob:                form.dob,
      school:             form.school.trim(),
      grade:              form.grade,
      requested_class_id: form.requested_class_id,
      parent_phone:       form.parent_phone.trim(),
      note:               form.note.trim() || undefined,
    });
    setSubmitting(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-indigo-950/30 dark:via-background dark:to-purple-950/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center shadow-xl border-0">
          <CardContent className="p-10 space-y-5">
            <div className="h-20 w-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Đăng ký thành công!</h2>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                Đơn đăng ký của <strong>{form.full_name}</strong> đã được ghi nhận.
                Admin sẽ xem xét và liên hệ qua email <strong>{form.email}</strong> trong vòng 1–2 ngày làm việc.
              </p>
            </div>
            <div className="bg-muted/50 rounded-xl p-4 text-left space-y-1.5 text-sm">
              <p className="text-muted-foreground">Lớp đăng ký:</p>
              <p className="font-semibold">{MOCK_CLASSES.find(c => c.id === form.requested_class_id)?.class_name}</p>
            </div>
            <Link href="/login">
              <Button className="w-full mt-2">
                <ArrowLeft className="h-4 w-4 mr-2" /> Về trang đăng nhập
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const field = (
    key: keyof FormData,
    label: string,
    Icon: React.ElementType,
    inputProps: React.InputHTMLAttributes<HTMLInputElement> = {}
  ) => (
    <div className="space-y-1.5">
      <label className="text-sm font-medium flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />{label}
        <span className="text-red-500">*</span>
      </label>
      <Input
        {...inputProps}
        value={form[key]}
        onChange={set(key)}
        className={errors[key] ? "border-red-400 focus:ring-red-400" : ""}
      />
      {errors[key] && <p className="text-xs text-red-500">{errors[key]}</p>}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-indigo-950/30 dark:via-background dark:to-purple-950/20 py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-8">

        {/* Header */}
        <div className="text-center space-y-3">
          <div className="h-16 w-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
            <GraduationCap className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Đăng ký Nhập học</h1>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Điền đầy đủ thông tin bên dưới. Admin sẽ liên hệ xác nhận và cung cấp tài khoản học viên qua email của bạn.
          </p>
          <Link href="/login" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            Đã có tài khoản? Đăng nhập <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <Card className="shadow-xl border-0">
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} noValidate className="space-y-6">

              {/* Section 1: Thông tin học viên */}
              <div>
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">1</span>
                  Thông tin học viên
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {field("full_name", "Họ và tên học viên", User, { placeholder: "Nguyễn Văn A" })}
                  {field("email", "Email", Mail, { type: "email", placeholder: "email@example.com" })}
                  {field("dob", "Ngày sinh", Calendar, { type: "date" })}
                  {field("school", "Trường đang học", BookOpen, { placeholder: "THPT Nguyễn Trãi" })}
                </div>
              </div>

              {/* Section 2: Đăng ký lớp */}
              <div className="border-t border-border/50 pt-6">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">2</span>
                  Đăng ký lớp học
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Grade */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <GraduationCap className="h-4 w-4 text-muted-foreground" /> Khối lớp
                      <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={form.grade}
                      onChange={set("grade")}
                      className={`w-full h-10 px-3 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-primary transition-shadow ${errors.grade ? "border-red-400 focus:ring-red-400" : "border-input"}`}
                    >
                      <option value="">Chọn khối lớp…</option>
                      {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                    {errors.grade && <p className="text-xs text-red-500">{errors.grade}</p>}
                  </div>

                  {/* Class */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-muted-foreground" /> Lớp đăng ký
                      <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={form.requested_class_id}
                      onChange={set("requested_class_id")}
                      className={`w-full h-10 px-3 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-primary transition-shadow ${errors.requested_class_id ? "border-red-400 focus:ring-red-400" : "border-input"}`}
                    >
                      <option value="">Chọn lớp học…</option>
                      {MOCK_CLASSES.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.class_name} — {c.subject}
                        </option>
                      ))}
                    </select>
                    {errors.requested_class_id && <p className="text-xs text-red-500">{errors.requested_class_id}</p>}
                  </div>
                </div>
              </div>

              {/* Section 3: Liên hệ phụ huynh */}
              <div className="border-t border-border/50 pt-6">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">3</span>
                  Thông tin liên hệ
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {field("parent_phone", "SĐT phụ huynh", Phone, { type: "tel", placeholder: "0912 345 678" })}
                  <div className="space-y-1.5 md:col-span-1" />
                </div>
                <div className="space-y-1.5 mt-4">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" /> Ghi chú / Nhu cầu học
                  </label>
                  <textarea
                    value={form.note}
                    onChange={set("note")}
                    rows={3}
                    placeholder="Ví dụ: em muốn ôn thi THPT Quốc gia, cần học cơ bản từ đầu…"
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary resize-none transition-shadow"
                  />
                </div>
              </div>

              <div className="pt-2">
                <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={submitting}>
                  {submitting ? (
                    <><span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full inline-block mr-2" />Đang gửi...</>
                  ) : (
                    <><CheckCircle2 className="h-5 w-5 mr-2" />Gửi đơn đăng ký</>
                  )}
                </Button>
                <p className="text-xs text-center text-muted-foreground mt-3">
                  Thông tin của bạn được bảo mật và chỉ dùng cho mục đích học tập.
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
