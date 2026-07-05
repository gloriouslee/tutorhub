"use client";

import { useState } from "react";
import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/shared";
import { MOCK_STUDENTS, MOCK_ATTENDANCE, MOCK_CLASSES } from "@/lib/mock-data";
import { formatDate } from "@/lib/utils";
import { CheckCircle2, Clock, XCircle, Calendar, User, BookOpen, AlertCircle } from "lucide-react";
import Image from "next/image";

// Parent p1 has students s1 and s4
const PARENT_ID = "p1";
const myChildren = MOCK_STUDENTS.filter(s => s.parent_id === PARENT_ID);

export default function ParentAttendancePage() {
  const [selectedChildId, setSelectedChildId] = useState<string>("all");

  // Get relevant attendance records
  const childIds = selectedChildId === "all" ? myChildren.map(c => c.id) : [selectedChildId];
  
  // To make the UI more populated, we'll generate some extra mock attendance 
  // based on MOCK_ATTENDANCE but expanded across a few weeks
  const baseAttendance = MOCK_ATTENDANCE.filter(a => childIds.includes(a.student_id));
  
  // Simulate more history for better UI demonstration
  const generateExtendedHistory = () => {
    const history = [...baseAttendance];
    if (history.length < 15) {
      childIds.forEach(cId => {
        const studentClasses = MOCK_CLASSES.filter(c => (c.student_ids ?? []).includes(cId));
        studentClasses.forEach((cls, idx) => {
          for (let i = 1; i <= 4; i++) {
            const date = new Date(2025, 4, 5 - i * 3); // some past dates
            history.push({
              id: `mock-${cId}-${cls.id}-${i}`,
              class_id: cls.id,
              student_id: cId,
              attendance_date: date.toISOString().split('T')[0],
              status: i % 7 === 0 ? "absent" : (i % 5 === 0 ? "late" : "present")
            });
          }
        });
      });
    }
    return history.sort((a, b) => new Date(b.attendance_date).getTime() - new Date(a.attendance_date).getTime());
  };

  const attendanceHistory = generateExtendedHistory();

  // Stats
  const totalSessions = attendanceHistory.length;
  const presentCount = attendanceHistory.filter(a => a.status === "present").length;
  const lateCount = attendanceHistory.filter(a => a.status === "late").length;
  const absentCount = attendanceHistory.filter(a => a.status === "absent").length;
  
  const presentRate = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0;

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case "present":
        return { label: "Có mặt", icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-100", border: "border-emerald-200" };
      case "late":
        return { label: "Đi muộn", icon: Clock, color: "text-amber-600", bg: "bg-amber-100", border: "border-amber-200" };
      case "absent":
        return { label: "Vắng mặt", icon: XCircle, color: "text-red-600", bg: "bg-red-100", border: "border-red-200" };
      case "excused":
        return { label: "Có phép", icon: AlertCircle, color: "text-blue-600", bg: "bg-blue-100", border: "border-blue-200" };
      default:
        return { label: "Chưa rõ", icon: AlertCircle, color: "text-slate-600", bg: "bg-slate-100", border: "border-slate-200" };
    }
  };

  return (
    <PortalLayout role="parent" userName="Trần Văn Minh" pageTitle="Chuyên cần">
      <div className="space-y-6 max-w-6xl mx-auto pb-10">
        <SectionHeader 
          title="Theo dõi chuyên cần" 
          subtitle="Quản lý lịch sử điểm danh và tình hình đi học của các con"
        />

        {/* Child Selector */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setSelectedChildId("all")}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all border-2 ${
              selectedChildId === "all" 
                ? "bg-primary text-primary-foreground border-primary shadow-md" 
                : "bg-card text-muted-foreground border-border hover:border-primary/30"
            }`}
          >
            Tất cả các con
          </button>
          {myChildren.map(child => (
            <button
              key={child.id}
              onClick={() => setSelectedChildId(child.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border-2 ${
                selectedChildId === child.id 
                  ? "bg-primary text-primary-foreground border-primary shadow-md" 
                  : "bg-card text-muted-foreground border-border hover:border-primary/30"
              }`}
            >
              <div className="h-6 w-6 rounded-full overflow-hidden bg-muted">
                <Image src={child.avatar_url || "/avatars/default.png"} alt={child.full_name} width={24} height={24} className="object-cover" />
              </div>
              {child.full_name}
            </button>
          ))}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-border/50 shadow-sm bg-gradient-to-br from-card to-card/50">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Tỷ lệ đi học</p>
                  <h3 className="text-3xl font-black text-foreground">{presentRate}%</h3>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <User className="h-6 w-6 text-primary" />
                </div>
              </div>
              <div className="mt-4 h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-1000" style={{ width: `${presentRate}%` }} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-200 dark:border-emerald-900/50 shadow-sm bg-emerald-50/50 dark:bg-emerald-950/20">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-emerald-600/80 dark:text-emerald-400/80 mb-1">Có mặt</p>
                  <h3 className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{presentCount}</h3>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
              <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-4 font-medium">Buổi học đúng giờ</p>
            </CardContent>
          </Card>

          <Card className="border-amber-200 dark:border-amber-900/50 shadow-sm bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-amber-600/80 dark:text-amber-400/80 mb-1">Đi muộn</p>
                  <h3 className="text-3xl font-black text-amber-600 dark:text-amber-400">{lateCount}</h3>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
              <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-4 font-medium">Cần chú ý thời gian</p>
            </CardContent>
          </Card>

          <Card className="border-red-200 dark:border-red-900/50 shadow-sm bg-red-50/50 dark:bg-red-950/20">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-red-600/80 dark:text-red-400/80 mb-1">Vắng mặt</p>
                  <h3 className="text-3xl font-black text-red-600 dark:text-red-400">{absentCount}</h3>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                  <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
              <p className="text-xs text-red-600/70 dark:text-red-400/70 mt-4 font-medium">Buổi học bị bỏ lỡ</p>
            </CardContent>
          </Card>
        </div>

        {/* Detailed History List */}
        <Card className="border-border/50 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-border/50 bg-muted/20 flex justify-between items-center">
            <h3 className="font-bold text-lg">Chi tiết điểm danh</h3>
            <Badge variant="outline" className="font-medium bg-background">{totalSessions} bản ghi</Badge>
          </div>
          <div className="p-0">
            {attendanceHistory.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>Chưa có dữ liệu điểm danh nào.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {attendanceHistory.map((record) => {
                  const student = MOCK_STUDENTS.find(s => s.id === record.student_id);
                  const cls = MOCK_CLASSES.find(c => c.id === record.class_id);
                  const statusInfo = getStatusDisplay(record.status);
                  const StatusIcon = statusInfo.icon;

                  return (
                    <div key={record.id} className="p-4 hover:bg-muted/30 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className={`h-12 w-12 rounded-2xl ${statusInfo.bg} ${statusInfo.color} flex items-center justify-center shrink-0 border ${statusInfo.border}`}>
                          <StatusIcon className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="font-bold text-foreground flex items-center gap-2">
                            {formatDate(record.attendance_date)}
                            <Badge variant="outline" className={`border-0 ${statusInfo.bg} ${statusInfo.color} font-bold text-[10px] uppercase`}>
                              {statusInfo.label}
                            </Badge>
                          </p>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1 font-medium">
                            {selectedChildId === "all" && (
                              <span className="flex items-center gap-1 text-primary"><User className="h-3.5 w-3.5" /> {student?.full_name}</span>
                            )}
                            <span className="flex items-center gap-1"><BookMarkedIcon className="h-3.5 w-3.5" /> {cls?.class_name}</span>
                          </div>
                        </div>
                      </div>
                      
                      {record.status !== 'present' && (
                        <div className="w-full sm:w-auto bg-muted/50 p-3 rounded-xl border border-border/50 text-sm italic text-muted-foreground flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                          <span>Giáo viên ghi chú: {record.status === 'late' ? "Vào lớp muộn 15 phút" : "Nghỉ học không phép"}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>

      </div>
    </PortalLayout>
  );
}

// Inline helper component for icon
function BookMarkedIcon(props: any) {
  return <BookOpen {...props} />;
}
