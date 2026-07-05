"use client";

import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SectionHeader, AttendanceBadge } from "@/components/shared";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CheckSquare, Calendar, Users, Check, X, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { getClasses, getStudents, getAttendance, saveAttendance } from "@/lib/storage";
import { Class, Student, Attendance } from "@/types";
import { formatDate, toLocalDateKey } from "@/lib/utils";

export default function AdminAttendancePage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [selectedDate, setSelectedDate] = useState(toLocalDateKey(new Date()));

  useEffect(() => {
    async function loadData() {
      const loadedClasses = await getClasses();
      setClasses(loadedClasses);
      setStudents(await getStudents());
      const loadedAttendance = await getAttendance();
      setAttendance(loadedAttendance);
      if (loadedClasses.length > 0) {
        setSelectedClass(loadedClasses[0]);
      }
    }
    loadData();
  }, []);

  // Compute overall stats
  const totalRecords = attendance.length;
  const presentRecords = attendance.filter(a => a.status === "present").length;
  const lateRecords = attendance.filter(a => a.status === "late").length;
  const absentRecords = attendance.filter(a => a.status === "absent").length;
  const attendanceRate = totalRecords > 0 ? Math.round(((presentRecords + lateRecords) / totalRecords) * 100) : null;

  // Students enrolled in a class, based on the class's real student_ids
  const getStudentsInClass = (cls: Class): Student[] =>
    students.filter(s => (cls.student_ids ?? []).includes(s.id));

  const handleMarkAttendance = async (studentId: string, status: "present" | "late" | "absent" | "excused") => {
    if (!selectedClass) return;

    // Check if record exists for this class, student, and date
    const existingIdx = attendance.findIndex(
      a => a.class_id === selectedClass.id && a.student_id === studentId && a.attendance_date === selectedDate
    );

    let updated: Attendance[] = [];
    if (existingIdx !== -1) {
      updated = attendance.map((a, idx) =>
        idx === existingIdx ? { ...a, status } : a
      );
    } else {
      const newRecord: Attendance = {
        id: `att${attendance.length + 1}-${Math.floor(Math.random() * 1000)}`,
        class_id: selectedClass.id,
        student_id: studentId,
        attendance_date: selectedDate,
        status,
        created_at: toLocalDateKey(new Date()),
      };
      updated = [newRecord, ...attendance];
    }
    setAttendance(updated);
    await saveAttendance(updated);
  };

  const classStudents = selectedClass ? getStudentsInClass(selectedClass) : [];

  return (
    <PortalLayout role="admin" userName="Admin User" pageTitle="Chuyên cần">
      <div className="space-y-6">
        <SectionHeader
          title="Điểm danh & Check-in"
          subtitle="Theo dõi và ghi nhận chuyên cần của học viên"
        />

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Tỷ lệ chuyên cần", value: attendanceRate !== null ? `${attendanceRate}%` : "—", icon: CheckSquare, color: "text-rose-500", bg: "bg-rose-50 dark:bg-rose-950/20" },
            { label: "Số lượt có mặt", value: presentRecords, icon: Check, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/20" },
            { label: "Số lượt đi muộn", value: lateRecords, icon: AlertCircle, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/20" },
            { label: "Số lượt vắng", value: absentRecords, icon: X, color: "text-red-500", bg: "bg-red-50 dark:bg-red-950/20" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <Card key={label} className="border border-border">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-semibold uppercase">{label}</p>
                  <p className="text-xl font-bold text-foreground mt-1">{value}</p>
                </div>
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${bg}`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left panel: Class list */}
          <Card className="lg:col-span-1 border border-border">
            <CardHeader className="pb-3 border-b border-border bg-muted/10">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-rose-500" /> Lớp đang hoạt động
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 space-y-1">
              {classes.map(cls => (
                <button
                  key={cls.id}
                  onClick={() => setSelectedClass(cls)}
                  className={`w-full text-left p-3 rounded-xl transition-all flex flex-col gap-1 ${
                    selectedClass?.id === cls.id
                      ? "bg-rose-500 text-white shadow-md"
                      : "hover:bg-muted text-foreground"
                  }`}
                >
                  <span className="text-sm font-bold truncate">{cls.class_name}</span>
                  <span className={`text-xs ${selectedClass?.id === cls.id ? "text-white/80" : "text-muted-foreground"}`}>
                    {cls.subject} · {cls.learning_mode}
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Right panel: Checklist */}
          <Card className="lg:col-span-2 border border-border">
            <CardHeader className="pb-3 border-b border-border bg-muted/10 flex flex-row items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle className="text-sm font-bold text-foreground">
                  Danh sách điểm danh: {selectedClass?.class_name}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Ghi nhận trạng thái chuyên cần cho ngày đã chọn.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-rose-500" />
                <input
                  type="date"
                  className="bg-card border border-border rounded-xl px-3 py-1.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-rose-500"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {classStudents.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground text-sm">
                  Chưa có học viên nào trong lớp này.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/5">
                        <th className="text-left p-4 text-xs font-semibold text-muted-foreground">Học viên</th>
                        <th className="text-left p-4 text-xs font-semibold text-muted-foreground">Trạng thái (ngày đã chọn)</th>
                        <th className="text-right p-4 text-xs font-semibold text-muted-foreground">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {classStudents.map(student => {
                        const rec = attendance.find(
                          a => a.class_id === selectedClass?.id && a.student_id === student.id && a.attendance_date === selectedDate
                        );
                        const status = rec?.status || "unmarked";

                        return (
                          <tr key={student.id} className="hover:bg-muted/10 transition-colors">
                            <td className="p-4">
                              <div className="flex items-center gap-2.5">
                                <Avatar size="sm">
                                  <AvatarFallback name={student.full_name} />
                                </Avatar>
                                <div>
                                  <p className="text-sm font-semibold text-foreground">{student.full_name}</p>
                                  <p className="text-[10px] text-muted-foreground">{student.grade} · {student.school}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              {status === "unmarked" ? (
                                <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-muted text-muted-foreground">
                                  Chưa điểm danh
                                </span>
                              ) : (
                                <AttendanceBadge status={status as any} />
                              )}
                            </td>
                            <td className="p-4">
                              <div className="flex items-center justify-end gap-1.5">
                                {[
                                  { key: "present" as const, label: "Có mặt", color: "bg-emerald-500 hover:bg-emerald-600 text-white" },
                                  { key: "late" as const, label: "Muộn", color: "bg-amber-500 hover:bg-amber-600 text-white" },
                                  { key: "absent" as const, label: "Vắng", color: "bg-red-500 hover:bg-red-600 text-white" },
                                ].map(btn => (
                                  <button
                                    key={btn.key}
                                    onClick={() => handleMarkAttendance(student.id, btn.key)}
                                    className={`px-2.5 py-1 text-[10px] font-semibold rounded-lg transition-all ${
                                      status === btn.key
                                        ? `${btn.color} ring-2 ring-offset-2 ring-primary/20`
                                        : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
                                    }`}
                                  >
                                    {btn.label}
                                  </button>
                                ))}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PortalLayout>
  );
}
