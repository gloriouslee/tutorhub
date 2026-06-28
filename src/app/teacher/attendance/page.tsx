"use client";

import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AttendanceBadge, LearningModeBadge, SectionHeader } from "@/components/shared";
import { MOCK_STUDENTS, MOCK_CLASSES, MOCK_ATTENDANCE } from "@/lib/mock-data";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDate } from "@/lib/utils";
import { CheckSquare, X, Clock, Plus } from "lucide-react";
import { useState } from "react";

const teacherClasses = MOCK_CLASSES.filter(c => c.tutor_id === "t1");

export default function TeacherAttendancePage() {
  const [selectedClass, setSelectedClass] = useState(teacherClasses[0]);
  const [date] = useState(new Date().toISOString().split("T")[0]);
  const [marks, setMarks] = useState<Record<string, "present" | "absent" | "late">>({});

  const mark = (studentId: string, status: "present" | "absent" | "late") => {
    setMarks(prev => ({ ...prev, [studentId]: status }));
  };

  return (
    <PortalLayout role="teacher" userName="Tiến sĩ Sarah Mitchell" pageTitle="Điểm danh">
      <div className="space-y-6">
        <SectionHeader title="Điểm danh học viên" subtitle="Ghi nhận chuyên cần cho các lớp của bạn" action={
          <Button variant="gradient"><CheckSquare className="h-4 w-4 mr-1" /> Lưu điểm danh</Button>
        } />

        {/* Class selector */}
        <div className="flex items-center gap-3 flex-wrap">
          {teacherClasses.map((cls) => (
            <button
              key={cls.id}
              onClick={() => setSelectedClass(cls)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                selectedClass?.id === cls.id
                  ? "text-white shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
              style={selectedClass?.id === cls.id ? { background: cls.color } : {}}
            >
              {cls.class_name}
              <LearningModeBadge mode={cls.learning_mode} />
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Mark attendance */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{selectedClass?.class_name} · {date}</CardTitle>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" /> Có mặt
                    <span className="h-2 w-2 rounded-full bg-amber-500 ml-2" /> Đi trễ
                    <span className="h-2 w-2 rounded-full bg-red-500 ml-2" /> Vắng mặt
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {MOCK_STUDENTS.map((student, i) => {
                    const status = marks[student.id];
                    return (
                      <div key={student.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors animate-fade-in" style={{ animationDelay: `${i * 60}ms` }}>
                        <Avatar size="sm"><AvatarFallback name={student.full_name} /></Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{student.full_name}</p>
                          <p className="text-xs text-muted-foreground">{student.grade} · {student.school}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {(["present", "late", "absent"] as const).map((s) => (
                            <button
                              key={s}
                              onClick={() => mark(student.id, s)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                status === s
                                  ? s === "present" ? "bg-emerald-500 text-white" :
                                    s === "late" ? "bg-amber-500 text-white" : "bg-red-500 text-white"
                                  : "bg-muted text-muted-foreground hover:bg-accent"
                              }`}
                            >
                              {s === "present" ? "Có mặt" : s === "late" ? "Đi trễ" : "Vắng mặt"}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
                  <p className="text-sm text-muted-foreground">
                    Đã điểm danh {Object.keys(marks).length}/{MOCK_STUDENTS.length}
                  </p>
                  <Button variant="gradient">
                    <CheckSquare className="h-4 w-4 mr-1" /> Hoàn tất
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent history */}
          <div>
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Lịch sử điểm danh</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {MOCK_ATTENDANCE.slice(0, 6).map((a) => {
                  const student = MOCK_STUDENTS.find(s => s.id === a.student_id);
                  return (
                    <div key={a.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors">
                      <Avatar size="sm"><AvatarFallback name={student?.full_name ?? "?"} /></Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{student?.full_name}</p>
                        <p className="text-[10px] text-muted-foreground">{formatDate(a.attendance_date)}</p>
                      </div>
                      <AttendanceBadge status={a.status} />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
