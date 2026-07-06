"use client";

import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { Settings, Database, Sliders, Shield, Download, RotateCcw, Save, Check } from "lucide-react";
import { useState, useEffect } from "react";
import { resetAllStorage, getStudents, getTeachers, getClasses, getPayments, getAttendance, getNotifications } from "@/lib/storage";

const TABS = [
  { id: "general"  as const, label: "Cài đặt chung",   icon: Settings  },
  { id: "academic" as const, label: "Cài đặt học thuật", icon: Sliders   },
  { id: "database" as const, label: "Cơ sở dữ liệu",   icon: Database  },
];

const TAB_TITLES: Record<string, string> = {
  general:  "Cài đặt chung",
  academic: "Cài đặt học thuật",
  database: "Cơ sở dữ liệu",
};

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<"general" | "academic" | "database">("general");
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [centerName, setCenterName] = useState("TutorHub Academy");
  const [phone, setPhone]           = useState("0987 654 321");
  const [email, setEmail]           = useState("contact@tutorhub.edu.vn");
  const [timezone, setTimezone]     = useState("GMT+7 (Asia/Ho_Chi_Minh)");

  const [lessonDuration, setLessonDuration] = useState("90");
  const [maxStudents, setMaxStudents]       = useState("15");
  const [gradingScale, setGradingScale]     = useState("0-10");

  const SETTINGS_KEY = "tutorhub_admin_settings";

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.centerName)     setCenterName(saved.centerName);
      if (saved.phone)          setPhone(saved.phone);
      if (saved.email)          setEmail(saved.email);
      if (saved.timezone)       setTimezone(saved.timezone);
      if (saved.lessonDuration) setLessonDuration(saved.lessonDuration);
      if (saved.maxStudents)    setMaxStudents(saved.maxStudents);
      if (saved.gradingScale)   setGradingScale(saved.gradingScale);
    } catch {
      // ignore corrupted settings
    }
  }, []);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const settings = { centerName, phone, email, timezone, lessonDuration, maxStudents, gradingScale };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleResetDatabase = async () => {
    if (confirm("Cảnh báo: Thao tác này sẽ xóa cache cục bộ trên máy này và khôi phục dữ liệu mẫu ban đầu (không ảnh hưởng dữ liệu trên server). Tiếp tục?")) {
      await resetAllStorage();
    }
  };

  const handleExportBackup = async () => {
    const backup = {
      students:      await getStudents(),
      teachers:      await getTeachers(),
      classes:       await getClasses(),
      payments:      await getPayments(),
      attendance:    await getAttendance(),
      notifications: await getNotifications(),
      exportedAt:    new Date().toISOString(),
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup, null, 2));
    const a = document.createElement("a");
    a.setAttribute("href", dataStr);
    a.setAttribute("download", `tutorhub_backup_${new Date().toISOString().split("T")[0]}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const SaveBar = () => (
    <div className="flex justify-end pt-4 border-t border-border mt-6 items-center gap-3">
      {saveSuccess && (
        <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
          <Check className="h-4 w-4" /> Đã lưu thành công!
        </span>
      )}
      <Button type="submit" variant="gradient" className="flex items-center gap-1.5 font-bold">
        <Save className="h-4 w-4" /> Lưu cài đặt
      </Button>
    </div>
  );

  return (
    <PortalLayout role="admin" userName="Admin User" pageTitle="Cài đặt">
      <div className="space-y-6">
        <SectionHeader
          title="Cài đặt hệ thống"
          subtitle="Cấu hình thông tin trung tâm, học thuật và sao lưu dữ liệu"
        />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Tab nav */}
          <Card className="lg:col-span-1 border border-border h-fit">
            <CardContent className="p-2 space-y-1">
              {TABS.map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full text-left p-3.5 rounded-xl transition-all flex items-center gap-2.5 font-semibold text-xs uppercase tracking-wider ${
                      activeTab === tab.id
                        ? "bg-rose-500 text-white shadow-md"
                        : "hover:bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* Panel */}
          <Card className="lg:col-span-3 border border-border">
            <CardHeader className="pb-3 border-b border-border bg-muted/10">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                {activeTab === "general"  && <Settings  className="h-4 w-4 text-rose-500" />}
                {activeTab === "academic" && <Sliders   className="h-4 w-4 text-rose-500" />}
                {activeTab === "database" && <Database  className="h-4 w-4 text-rose-500" />}
                {TAB_TITLES[activeTab]}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">

              {/* General */}
              {activeTab === "general" && (
                <form onSubmit={handleSaveSettings} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Tên trung tâm *</label>
                      <Input required value={centerName} onChange={e => setCenterName(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Số điện thoại</label>
                      <Input value={phone} onChange={e => setPhone(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Email liên hệ</label>
                      <Input type="email" value={email} onChange={e => setEmail(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Múi giờ hệ thống</label>
                      <Input value={timezone} onChange={e => setTimezone(e.target.value)} />
                    </div>
                  </div>
                  <SaveBar />
                </form>
              )}

              {/* Academic */}
              {activeTab === "academic" && (
                <form onSubmit={handleSaveSettings} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Thời lượng buổi học (phút)</label>
                      <Input type="number" value={lessonDuration} onChange={e => setLessonDuration(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Sĩ số tối đa mỗi lớp</label>
                      <Input type="number" value={maxStudents} onChange={e => setMaxStudents(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Thang điểm đánh giá</label>
                      <select
                        className="flex h-10 w-full items-center justify-between rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none"
                        value={gradingScale}
                        onChange={e => setGradingScale(e.target.value)}
                      >
                        <option value="0-10">Thang điểm 10 (0–10)</option>
                        <option value="A-F">Xếp loại chữ (A–F)</option>
                        <option value="0-100">Thang điểm 100 (0–100)</option>
                      </select>
                    </div>
                  </div>
                  <SaveBar />
                </form>
              )}

              {/* Database */}
              {activeTab === "database" && (
                <div className="space-y-6">
                  <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-950 bg-rose-50/50 dark:bg-rose-950/10 flex items-start gap-3">
                    <Shield className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
                    <div className="space-y-1 text-xs">
                      <p className="font-bold text-foreground">Chế độ Demo (Client-side)</p>
                      <p className="text-muted-foreground leading-relaxed">
                        TutorHub hiện đang chạy ở chế độ demo phía client. Toàn bộ dữ liệu (thêm/xóa học viên, lớp học, điểm danh) được lưu trong localStorage của trình duyệt. Bạn có thể xuất bản sao lưu hoặc khôi phục về dữ liệu mẫu ban đầu.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <Card className="border border-border hover:bg-muted/10 transition-all">
                      <CardContent className="p-4 space-y-3">
                        <div className="space-y-1">
                          <h6 className="text-sm font-bold text-foreground">Sao lưu dữ liệu</h6>
                          <p className="text-xs text-muted-foreground">Tải toàn bộ dữ liệu hiện tại dưới dạng tệp JSON.</p>
                        </div>
                        <Button type="button" variant="outline" className="w-full flex items-center justify-center gap-1.5 font-semibold" onClick={handleExportBackup}>
                          <Download className="h-4 w-4 text-rose-500" /> Xuất bản sao lưu
                        </Button>
                      </CardContent>
                    </Card>

                    <Card className="border border-border hover:bg-muted/10 transition-all">
                      <CardContent className="p-4 space-y-3">
                        <div className="space-y-1">
                          <h6 className="text-sm font-bold text-foreground">Khôi phục dữ liệu mẫu</h6>
                          <p className="text-xs text-muted-foreground">Xóa cache cục bộ trên máy này và khôi phục dữ liệu mẫu (không xóa dữ liệu trên server).</p>
                        </div>
                        <Button type="button" variant="outline" className="w-full flex items-center justify-center gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 font-semibold" onClick={handleResetDatabase}>
                          <RotateCcw className="h-4 w-4" /> Khôi phục mặc định
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

            </CardContent>
          </Card>
        </div>
      </div>
    </PortalLayout>
  );
}
