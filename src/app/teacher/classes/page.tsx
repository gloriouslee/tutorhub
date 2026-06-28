"use client";

import Link from "next/link";
import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LearningModeBadge, SectionHeader } from "@/components/shared";
import { MOCK_CLASSES } from "@/lib/mock-data";
import { BookOpen, Clock, Video, MapPin, Users, Settings } from "lucide-react";

export default function TeacherClassesPage() {
  return (
    <PortalLayout role="teacher" userName="Thầy Hùng Toán" pageTitle="Lớp học của tôi">
      <div className="space-y-6">
        <SectionHeader 
          title="Danh sách lớp đang dạy" 
          subtitle="Các lớp bạn được phân công trong học kỳ này"
          action={<Button size="sm" variant="gradient">Tạo lớp mới</Button>}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {MOCK_CLASSES.map((cls, i) => (
            <Card key={cls.id} className="overflow-hidden hover:shadow-lg transition-all duration-200 group animate-fade-in" style={{ animationDelay: `${i * 100}ms` }}>
              {/* Color bar */}
              <div className="h-1.5 w-full" style={{ background: cls.color }} />
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm" style={{ background: cls.color }}>
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-sm leading-snug">{cls.class_name}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">{cls.subject}</p>
                    </div>
                  </div>
                  <LearningModeBadge mode={cls.learning_mode} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {cls.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{cls.description}</p>
                )}
                <div className="space-y-1.5">
                  {cls.schedule.map((s, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3 shrink-0" />
                      <span>{s.day} · {s.start_time} – {s.end_time}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {cls.classroom && (
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{cls.classroom}</span>
                  )}
                  {cls.max_students && (
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" />{Math.floor(Math.random() * 5) + 15}/{cls.max_students} học viên</span>
                  )}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  {cls.zoom_link && (
                    <Button size="sm" variant="gradient" className="flex-1">
                      <Video className="h-3.5 w-3.5" /> Mở lớp Online
                    </Button>
                  )}
                  <Link href={`/teacher/classes/${cls.id}`} className={cls.zoom_link ? "flex-1" : "w-full"}>
                    <Button size="sm" variant="outline" className="w-full">
                      <Settings className="h-3.5 w-3.5" /> Quản lý
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </PortalLayout>
  );
}
