"use client";

import { useState, useEffect } from "react";
import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/shared";
import { MOCK_STUDENTS, MOCK_CLASSES } from "@/lib/mock-data";
import { getCurrentStudentAccount, type StudentAccount } from "@/lib/storage";
import {
  User, Mail, Phone, BookOpen, Shield, Key, Camera,
  GraduationCap, Calendar, CheckCircle2,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Merge mock student + approved enrollment account data
// ─────────────────────────────────────────────────────────────────────────────

interface ProfileData {
  full_name: string;
  email: string;
  dob: string;
  school: string;
  grade: string;
  parent_phone: string;
  student_id: string;
  assigned_class_id?: string;
  username?: string;
  from_enrollment: boolean;
}

function buildProfile(account: StudentAccount | null): ProfileData {
  if (account) {
    return {
      full_name:         account.full_name,
      email:             account.email,
      dob:               account.dob,
      school:            account.school,
      grade:             account.grade,
      parent_phone:      account.parent_phone,
      student_id:        account.student_id,
      assigned_class_id: account.assigned_class_id,
      username:          account.username,
      from_enrollment:   true,
    };
  }
  // Fallback to mock student s1
  const s = MOCK_STUDENTS[0];
  return {
    full_name:       s.full_name,
    email:           s.email,
    dob:             s.dob,
    school:          s.school,
    grade:           s.grade,
    parent_phone:    "0912 345 678",
    student_id:      s.id,
    from_enrollment: false,
  };
}

export default function StudentProfilePage() {
  const [account, setAccount] = useState<StudentAccount | null>(null);
  const [loaded,  setLoaded]  = useState(false);

  useEffect(() => {
    setAccount(getCurrentStudentAccount());
    setLoaded(true);
  }, []);

  if (!loaded) return null;

  const profile = buildProfile(account);
  const assignedClass = profile.assigned_class_id
    ? MOCK_CLASSES.find(c => c.id === profile.assigned_class_id)
    : null;

  const initials = profile.full_name
    .split(" ")
    .map(n => n[0])
    .join("")
    .slice(-2)
    .toUpperCase();

  return (
    <PortalLayout role="student" userName={profile.full_name} pageTitle="Hồ sơ cá nhân">
      <div className="space-y-6 max-w-5xl mx-auto">
        <SectionHeader
          title="Thông tin tài khoản"
          subtitle="Quản lý thông tin cá nhân và cài đặt bảo mật"
        />

        {/* Enrollment sync banner */}
        {profile.from_enrollment && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/50">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                Thông tin đồng bộ từ đơn đăng ký nhập học
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                Thông tin dưới đây được cập nhật tự động khi admin duyệt đơn của bạn.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: avatar + summary */}
          <div className="space-y-6">
            <Card className="overflow-hidden border-border/50 shadow-sm">
              <div className="h-24 bg-gradient-to-r from-primary/80 to-primary" />
              <CardContent className="p-6 pt-0 flex flex-col items-center text-center relative">
                <div className="relative -mt-12 mb-4 group cursor-pointer">
                  <Avatar className="h-24 w-24 border-4 border-card shadow-sm">
                    <AvatarFallback className="text-2xl bg-primary/10 text-primary font-bold">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="h-6 w-6 text-white" />
                  </div>
                </div>

                <h2 className="text-xl font-bold text-foreground mb-1">{profile.full_name}</h2>
                <p className="text-sm text-muted-foreground mb-4">{profile.grade}</p>

                <div className="w-full space-y-2 mt-1">
                  <div className="flex items-center justify-between text-sm p-3 bg-muted/40 rounded-xl">
                    <span className="text-muted-foreground flex items-center gap-2"><Shield className="h-4 w-4" />ID</span>
                    <span className="font-semibold text-foreground font-mono text-xs">{profile.student_id.toUpperCase()}</span>
                  </div>
                  {profile.username && (
                    <div className="flex items-center justify-between text-sm p-3 bg-muted/40 rounded-xl">
                      <span className="text-muted-foreground flex items-center gap-2"><Mail className="h-4 w-4" />Tài khoản</span>
                      <span className="font-semibold text-foreground text-xs truncate max-w-[120px]">{profile.username}</span>
                    </div>
                  )}
                  {assignedClass && (
                    <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 text-left">
                      <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                        <BookOpen className="h-3 w-3" /> Lớp học
                      </p>
                      <p className="text-sm font-semibold text-foreground">{assignedClass.class_name}</p>
                      <p className="text-xs text-muted-foreground">{assignedClass.subject}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Change password */}
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-base flex items-center gap-2">
                  <Key className="h-4 w-4 text-primary" /> Đổi mật khẩu
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Mật khẩu hiện tại</label>
                  <Input type="password" placeholder="••••••••" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Mật khẩu mới</label>
                  <Input type="password" placeholder="••••••••" />
                </div>
                <Button className="w-full" variant="outline">Cập nhật mật khẩu</Button>
              </CardContent>
            </Card>
          </div>

          {/* Right: detail form */}
          <div className="lg:col-span-2">
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-4 border-b border-border/50">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Chi tiết Thông tin</CardTitle>
                  {profile.from_enrollment && (
                    <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Đã xác thực
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <form className="space-y-6" onSubmit={e => e.preventDefault()}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" /> Họ và tên
                      </label>
                      <Input defaultValue={profile.full_name} className="bg-muted/30" />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" /> Ngày sinh
                      </label>
                      <Input type="date" defaultValue={profile.dob} className="bg-muted/30" />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" /> Email
                      </label>
                      <Input type="email" defaultValue={profile.email} className="bg-muted/30" />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" /> SĐT phụ huynh
                      </label>
                      <Input type="tel" defaultValue={profile.parent_phone} className="bg-muted/30" />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <GraduationCap className="h-4 w-4 text-muted-foreground" /> Khối lớp
                      </label>
                      <Input defaultValue={profile.grade} className="bg-muted/30" />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-muted-foreground" /> Trường học
                      </label>
                      <Input defaultValue={profile.school} className="bg-muted/30" />
                    </div>

                    {assignedClass && (
                      <div className="md:col-span-2 space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-muted-foreground" /> Lớp đang học
                        </label>
                        <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl border border-border/50">
                          <div className="h-3 w-3 rounded-full shrink-0" style={{ background: assignedClass.color }} />
                          <div>
                            <p className="text-sm font-semibold">{assignedClass.class_name}</p>
                            <p className="text-xs text-muted-foreground">{assignedClass.subject} · {assignedClass.learning_mode}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-6 border-t border-border flex justify-end gap-3">
                    <Button type="button" variant="ghost">Hủy thay đổi</Button>
                    <Button type="submit" variant="gradient" className="px-8">Lưu thông tin</Button>
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
