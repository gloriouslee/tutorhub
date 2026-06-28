"use client";

import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SectionHeader } from "@/components/shared";
import { MOCK_STUDENTS } from "@/lib/mock-data";
import { User, Mail, Phone, MapPin, BookOpen, Shield, Key, Camera } from "lucide-react";

export default function StudentProfilePage() {
  const student = MOCK_STUDENTS[0]; // Nguyễn Anh Tuấn

  return (
    <PortalLayout role="student" userName="Nguyễn Anh Tuấn" pageTitle="Hồ sơ cá nhân">
      <div className="space-y-6 max-w-5xl mx-auto">
        <SectionHeader 
          title="Thông tin tài khoản" 
          subtitle="Quản lý thông tin cá nhân và cài đặt bảo mật"
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cột trái: Avatar và Tóm tắt */}
          <div className="space-y-6">
            <Card className="overflow-hidden border-border/50 shadow-sm">
              <div className="h-24 bg-gradient-to-r from-primary/80 to-primary" />
              <CardContent className="p-6 pt-0 flex flex-col items-center text-center relative">
                <div className="relative -mt-12 mb-4 group cursor-pointer">
                  <Avatar className="h-24 w-24 border-4 border-card shadow-sm">
                    <AvatarFallback className="text-2xl bg-primary/10 text-primary font-bold">AT</AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="h-6 w-6 text-white" />
                  </div>
                </div>
                
                <h2 className="text-xl font-bold text-foreground mb-1">{student.full_name}</h2>
                <p className="text-sm text-muted-foreground mb-4">Học viên hệ {student.learning_type === "online" ? "Online" : "Offline"}</p>
                
                <div className="w-full space-y-3 mt-2">
                  <div className="flex items-center justify-between text-sm p-3 bg-muted/40 rounded-xl">
                    <span className="text-muted-foreground flex items-center gap-2"><BookOpen className="h-4 w-4" /> Lớp</span>
                    <span className="font-semibold text-foreground">{student.grade}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm p-3 bg-muted/40 rounded-xl">
                    <span className="text-muted-foreground flex items-center gap-2"><Shield className="h-4 w-4" /> ID</span>
                    <span className="font-semibold text-foreground font-mono">{student.id.toUpperCase()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

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

          {/* Cột phải: Form thông tin */}
          <div className="lg:col-span-2">
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-4 border-b border-border/50">
                <CardTitle className="text-lg">Chi tiết Thông tin</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <form className="space-y-6" onSubmit={e => e.preventDefault()}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2 text-foreground">
                        <User className="h-4 w-4 text-muted-foreground" /> Họ và tên
                      </label>
                      <Input defaultValue={student.full_name} className="bg-muted/30" />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2 text-foreground">
                        <User className="h-4 w-4 text-muted-foreground" /> Ngày sinh
                      </label>
                      <Input type="date" defaultValue={student.dob} className="bg-muted/30" />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2 text-foreground">
                        <Mail className="h-4 w-4 text-muted-foreground" /> Email liên hệ
                      </label>
                      <Input type="email" defaultValue="alex.t@example.com" className="bg-muted/30" />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2 text-foreground">
                        <Phone className="h-4 w-4 text-muted-foreground" /> Số điện thoại
                      </label>
                      <Input type="tel" defaultValue="0912 345 678" className="bg-muted/30" />
                    </div>

                    <div className="md:col-span-2 space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2 text-foreground">
                        <MapPin className="h-4 w-4 text-muted-foreground" /> Địa chỉ
                      </label>
                      <Input defaultValue="123 Nguyễn Văn Linh, Quận 7, TP.HCM" className="bg-muted/30" />
                    </div>

                    <div className="md:col-span-2 space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2 text-foreground">
                        <BookOpen className="h-4 w-4 text-muted-foreground" /> Trường học hiện tại
                      </label>
                      <Input defaultValue={student.school} className="bg-muted/30" />
                    </div>
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
