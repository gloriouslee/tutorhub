"use client";

import { useState, useEffect } from "react";
import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/shared";
import { MOCK_STUDENTS } from "@/lib/mock-data";
import {
  GraduationCap, Building2, BookOpen,
  Activity, Target, ChevronRight, CalendarDays, Award
} from "lucide-react";
import Link from "next/link";
import { useParentContext } from "@/hooks/useParentContext";
import { loadChildrenAttendance, attendanceRate, loadChildScores, averageScore } from "@/lib/parent-data";

const GRADIENTS = [
  "from-indigo-500 to-purple-600",
  "from-teal-500 to-emerald-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
];

export default function ParentChildrenPage() {
  const { parentName, children, ready } = useParentContext();

  // Điểm TB và tỉ lệ chuyên cần thật theo từng con (null = chưa có dữ liệu → "—")
  const [avgByChild, setAvgByChild] = useState<Record<string, number | null>>({});
  const [attByChild, setAttByChild] = useState<Record<string, number | null>>({});

  useEffect(() => {
    if (!ready) return;
    const ids = children.map(c => c.id);

    loadChildrenAttendance(ids).then(records => {
      setAttByChild(Object.fromEntries(
        children.map(c => [c.id, attendanceRate(records.filter(r => r.student_id === c.id))])
      ));
    });

    Promise.all(
      children.map(async c =>
        [c.id, averageScore(await loadChildScores(c.id, c.classes.map(cl => cl.id)))] as const
      )
    ).then(entries => setAvgByChild(Object.fromEntries(entries)));
  }, [ready, children]);

  // Helper to map learning type to Vietnamese
  const getLearningTypeLabel = (type: string) => {
    switch(type) {
      case 'online': return 'Học trực tuyến';
      case 'offline': return 'Học tại trung tâm';
      case 'hybrid': return 'Học kết hợp (Hybrid)';
      default: return type;
    }
  };

  return (
    <PortalLayout role="parent" userName={parentName} pageTitle="Hồ sơ các con">
      <div className="space-y-8 max-w-6xl mx-auto pb-10">
        <SectionHeader
          title="Hồ sơ các con"
          subtitle="Quản lý thông tin và theo dõi lớp học của các con đang theo học tại TutorHub"
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {children.map((child, index) => {
            const enrolledClasses = child.classes;
            const avg = avgByChild[child.id] ?? null;
            const avgScoreLabel = avg != null ? avg.toFixed(1) : "—";
            const attendance = attByChild[child.id] ?? null;
            // Hồ sơ đăng ký (hình thức học, ngày nhập học) chưa có nguồn thật —
            // tra cứu từ mock roster làm dữ liệu demo.
            const profile = MOCK_STUDENTS.find(s => s.id === child.id);
            const bgGradient = GRADIENTS[index % GRADIENTS.length];

            return (
              <Card key={child.id} className="border-0 shadow-lg overflow-hidden group hover:shadow-xl transition-all duration-300">
                {/* Header Profile Area */}
                <div className={`bg-gradient-to-r ${bgGradient} p-6 relative overflow-hidden`}>
                  <div className="absolute top-0 right-0 opacity-10 translate-x-4 -translate-y-4 transition-transform duration-500 group-hover:scale-110">
                    <GraduationCap className="h-40 w-40 text-white" />
                  </div>

                  <div className="relative z-10 flex items-center gap-5">
                    <div className="h-20 w-20 rounded-2xl bg-white/20 backdrop-blur-md border-2 border-white/40 shadow-inner flex items-center justify-center text-3xl font-black text-white shrink-0">
                      {child.name.charAt(0)}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white mb-1">{child.name}</h2>
                      <div className="flex flex-wrap items-center gap-2 text-white/80 text-sm">
                        {child.school && (
                          <span className="flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded-md">
                            <Building2 className="h-3.5 w-3.5" /> {child.school}
                          </span>
                        )}
                        {child.grade && (
                          <span className="flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded-md">
                            <GraduationCap className="h-3.5 w-3.5" /> {child.grade}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-3 divide-x divide-border border-b border-border bg-muted/20">
                  <div className="p-4 flex flex-col items-center justify-center text-center">
                    <span className="text-2xl font-black text-foreground">{avgScoreLabel}</span>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1 mt-1">
                      <Target className="h-3 w-3" /> Điểm TB
                    </span>
                  </div>
                  <div className="p-4 flex flex-col items-center justify-center text-center">
                    <span className="text-2xl font-black text-foreground">{attendance !== null ? `${attendance}%` : "—"}</span>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1 mt-1">
                      <Activity className="h-3 w-3" /> Chuyên cần
                    </span>
                  </div>
                  <div className="p-4 flex flex-col items-center justify-center text-center">
                    <span className="text-2xl font-black text-foreground">{enrolledClasses.length}</span>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1 mt-1">
                      <BookOpen className="h-3 w-3" /> Lớp học
                    </span>
                  </div>
                </div>

                <CardContent className="p-6">
                  {/* Detailed Info */}
                  <div className="mb-6">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" /> Thông tin đăng ký
                    </h3>
                    <div className="space-y-3 bg-muted/30 p-4 rounded-xl border border-border/50">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Hình thức học:</span>
                        <Badge variant="outline" className="font-semibold bg-background">
                          {profile ? getLearningTypeLabel(profile.learning_type) : "Đang cập nhật"}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Ngày nhập học:</span>
                        <span className="font-medium text-foreground">
                          {profile ? new Date(profile.created_at).toLocaleDateString('vi-VN') : "—"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Danh hiệu hiện tại:</span>
                        <span className="font-medium text-amber-600 dark:text-amber-500 flex items-center gap-1">
                          <Award className="h-4 w-4" /> Học viên Tiêu biểu
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Classes Enrolled */}
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                      <BookOpen className="h-4 w-4" /> Lớp học đang tham gia
                    </h3>
                    <div className="space-y-2">
                      {enrolledClasses.length > 0 ? enrolledClasses.map(cls => (
                        <div key={cls.id} className="flex items-center justify-between p-3 rounded-xl border border-border hover:border-primary/50 transition-colors bg-card">
                          <div>
                            <p className="font-bold text-sm text-foreground">{cls.class_name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{cls.subject}</p>
                          </div>
                          <Badge className="bg-primary/10 text-primary border-0 hover:bg-primary/20">
                            {cls.schedule?.length ?? 0} buổi/tuần
                          </Badge>
                        </div>
                      )) : (
                        <p className="text-sm text-muted-foreground text-center py-3">Chưa tham gia lớp học nào.</p>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-6 flex gap-3">
                    <Button variant="outline" className="flex-1" asChild>
                      <Link href={`/parent/schedule`}>Xem thời khóa biểu</Link>
                    </Button>
                    <Button className="flex-1" asChild>
                      <Link href={`/parent/progress`}>
                        Báo cáo tiến độ <ChevronRight className="h-4 w-4 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Add New Child Card */}
          <Card className="border-2 border-dashed shadow-none flex flex-col items-center justify-center p-8 bg-muted/10 hover:bg-muted/30 transition-colors text-center min-h-[400px] cursor-pointer group">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-primary/20 transition-all">
              <div className="text-3xl font-light text-primary">+</div>
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">Đăng ký thêm học viên</h3>
            <p className="text-sm text-muted-foreground max-w-[250px]">
              Đăng ký thêm lớp học cho con thứ 2, thứ 3 của bạn để nhận ưu đãi lên đến 15% học phí.
            </p>
            <Button variant="outline" className="mt-6 font-semibold">
              Đăng ký ngay
            </Button>
          </Card>
        </div>
      </div>
    </PortalLayout>
  );
}
