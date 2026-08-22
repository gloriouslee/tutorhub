"use client";

import { Database, Download, RotateCcw, ShieldCheck } from "lucide-react";
import PortalLayout from "@/components/layout/PortalLayout";
import { SectionHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getAllTeacherAttendance,
  getClasses,
  getNotifications,
  getStudents,
  getTeachers,
  resetAllStorage,
} from "@/lib/storage";

export default function AdminSettingsPage() {
  async function clearBrowserCache() {
    const confirmed = confirm(
      "Chỉ xóa cache TutorHub trên trình duyệt này. Dữ liệu trên Supabase không bị thay đổi. Tiếp tục?",
    );
    if (!confirmed) return;
    await resetAllStorage();
    window.location.reload();
  }

  async function exportReferenceData() {
    const [students, teachers, classes, attendance, notifications] = await Promise.all([
      getStudents(),
      getTeachers(),
      getClasses(),
      getAllTeacherAttendance(),
      getNotifications(),
    ]);
    const data = {
      students,
      teachers,
      classes,
      attendance,
      notifications,
      exported_at: new Date().toISOString(),
      note: "Tệp tham khảo do trình duyệt xuất, không phải bản sao lưu có thể khôi phục hệ thống.",
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `tutorhub_reference_${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <PortalLayout role="admin" userName="Admin" pageTitle="Công cụ hệ thống">
      <div className="mx-auto max-w-4xl space-y-6">
        <SectionHeader
          title="Công cụ hệ thống"
          subtitle="Các thao tác hỗ trợ trình duyệt; cấu hình nghiệp vụ không còn được lưu cục bộ."
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              Nguồn dữ liệu
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-muted-foreground">
            Supabase là nguồn dữ liệu chính. Những cấu hình chỉ tồn tại trong
            localStorage đã được gỡ bỏ để tránh mỗi máy hiển thị một cấu hình khác nhau.
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="h-4 w-4 text-primary" />
                Xuất dữ liệu tham khảo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Tải JSON để đối soát nhanh. Đây không phải bản backup và không thể dùng
                để khôi phục hệ thống.
              </p>
              <Button variant="outline" className="w-full" onClick={exportReferenceData}>
                <Download className="mr-2 h-4 w-4" />
                Tải dữ liệu tham khảo
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <RotateCcw className="h-4 w-4 text-amber-600" />
                Xóa cache trình duyệt
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Dùng khi dữ liệu trên máy này bị cũ. Thao tác không xóa dữ liệu Supabase.
              </p>
              <Button variant="outline" className="w-full" onClick={clearBrowserCache}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Xóa cache và tải lại
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </PortalLayout>
  );
}
