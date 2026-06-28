"use client";

import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/shared";
import { MOCK_ATTENDANCE, MOCK_CLASSES } from "@/lib/mock-data";
import { CheckCircle2, XCircle, Clock, CalendarDays, Calendar as CalendarIcon, CheckSquare, AlertCircle } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function StudentAttendancePage() {
  const studentAttendance = MOCK_ATTENDANCE.filter(a => a.student_id === "s1");

  const totalSessions = studentAttendance.length;
  const presentCount = studentAttendance.filter(a => a.status === "present").length;
  const absentCount = studentAttendance.filter(a => a.status === "absent").length;
  const lateCount = studentAttendance.filter(a => a.status === "late").length;
  const attendanceRate = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 100;

  return (
    <PortalLayout role="student" userName="Nguyễn Anh Tuấn" pageTitle="Chuyên cần">
      <div className="space-y-6 max-w-6xl mx-auto">
        <SectionHeader 
          title="Thông tin Chuyên cần" 
          subtitle="Theo dõi quá trình tham gia các lớp học của bạn"
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white animate-fade-in shadow-md border-0">
            <CardContent className="p-5 flex flex-col items-center justify-center text-center h-full">
              <CheckSquare className="h-6 w-6 text-indigo-200 mb-2" />
              <h3 className="text-4xl font-black mb-1">{attendanceRate}%</h3>
              <p className="text-xs font-medium text-indigo-100 uppercase tracking-wider">Tỷ lệ đi học</p>
            </CardContent>
          </Card>
          
          <Card className="animate-fade-in delay-100">
            <CardContent className="p-5 flex flex-col items-center justify-center text-center h-full">
              <CheckCircle2 className="h-6 w-6 text-emerald-500 mb-2" />
              <h3 className="text-3xl font-bold mb-1 text-emerald-600 dark:text-emerald-400">{presentCount}</h3>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Có mặt</p>
            </CardContent>
          </Card>

          <Card className="animate-fade-in delay-200">
            <CardContent className="p-5 flex flex-col items-center justify-center text-center h-full">
              <Clock className="h-6 w-6 text-amber-500 mb-2" />
              <h3 className="text-3xl font-bold mb-1 text-amber-600 dark:text-amber-400">{lateCount}</h3>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Đi trễ</p>
            </CardContent>
          </Card>

          <Card className="animate-fade-in delay-300">
            <CardContent className="p-5 flex flex-col items-center justify-center text-center h-full">
              <XCircle className="h-6 w-6 text-red-500 mb-2" />
              <h3 className="text-3xl font-bold mb-1 text-red-600 dark:text-red-400">{absentCount}</h3>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Vắng mặt</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          <div className="lg:col-span-2 space-y-4">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" /> Lịch sử điểm danh
            </h3>
            
            <div className="bg-card rounded-xl border border-border shadow-sm">
              <div className="divide-y divide-border/50">
                {studentAttendance.length > 0 ? studentAttendance.map((record, i) => {
                  const relatedClass = MOCK_CLASSES.find(c => c.id === record.class_id);
                  let statusColor = "text-emerald-500";
                  let statusBg = "bg-emerald-50 dark:bg-emerald-900/20";
                  let statusText = "Có mặt";
                  let Icon = CheckCircle2;

                  if (record.status === "absent") {
                    statusColor = "text-red-500";
                    statusBg = "bg-red-50 dark:bg-red-900/20";
                    statusText = "Vắng mặt";
                    Icon = XCircle;
                  } else if (record.status === "late") {
                    statusColor = "text-amber-500";
                    statusBg = "bg-amber-50 dark:bg-amber-900/20";
                    statusText = "Đi trễ";
                    Icon = Clock;
                  }

                  return (
                    <div key={record.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors animate-fade-in" style={{ animationDelay: `${i * 100}ms` }}>
                      <div className="flex items-center gap-4">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${statusBg} ${statusColor}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{relatedClass?.class_name || "Lớp học"}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                            <CalendarIcon className="h-3 w-3" /> {formatDate(record.attendance_date)}
                          </p>
                        </div>
                      </div>
                      
                      <Badge variant="outline" className={`${statusColor} bg-background`}>
                        {statusText}
                      </Badge>
                    </div>
                  );
                }) : (
                  <div className="p-8 text-center text-muted-foreground">
                    Chưa có dữ liệu điểm danh nào.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-bold text-lg">Cảnh báo & Lưu ý</h3>
            <Card className="bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900 shadow-none">
              <CardContent className="p-5">
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-amber-800 dark:text-amber-300 text-sm mb-1">Nội quy chuyên cần</h4>
                    <p className="text-xs text-amber-700/80 dark:text-amber-400/80 leading-relaxed mb-3">
                      Học viên vắng quá 20% tổng số buổi học sẽ không được phép tham gia thi cuối kỳ. Vui lòng liên hệ Giáo vụ nếu bạn cần xin phép nghỉ học.
                    </p>
                    <button className="text-xs font-bold text-amber-700 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-300 uppercase tracking-wide">
                      Làm đơn xin phép &rarr;
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
