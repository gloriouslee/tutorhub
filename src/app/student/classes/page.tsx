"use client";

import { useState } from "react";
import Link from "next/link";
import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LearningModeBadge, SectionHeader, ProgressBar } from "@/components/shared";
import { MOCK_CLASSES, MOCK_TEACHERS } from "@/lib/mock-data";
import { BookOpen, Clock, Video, MapPin, Users, Search, Filter, ChevronRight } from "lucide-react";

export default function StudentClassesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "online" | "offline">("all");

  const filteredClasses = MOCK_CLASSES.filter(cls => {
    const matchSearch = cls.class_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        cls.subject.toLowerCase().includes(searchTerm.toLowerCase());
    const matchMode = filterMode === "all" || cls.learning_mode === filterMode;
    return matchSearch && matchMode;
  });

  return (
    <PortalLayout role="student" userName="Nguyễn Anh Tuấn" pageTitle="Lớp học của tôi">
      <div className="space-y-6 max-w-6xl mx-auto">
        <SectionHeader 
          title="Lớp học đã đăng ký" 
          subtitle="Quản lý và tham gia các khóa học trong học kỳ này"
        />

        {/* Thanh công cụ Tìm kiếm & Lọc */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between bg-card p-2 rounded-2xl border border-border shadow-sm mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Tìm kiếm tên lớp, môn học..." 
              className="pl-9 bg-transparent border-0 focus-visible:ring-0 shadow-none h-11"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-2 px-2 sm:px-0 pb-2 sm:pb-0 overflow-x-auto">
            {(["all", "online", "offline"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setFilterMode(mode)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                  filterMode === mode 
                    ? "bg-primary text-primary-foreground shadow-md" 
                    : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
                }`}
              >
                {mode === "all" ? "Tất cả" : mode === "online" ? "Online" : "Offline"}
              </button>
            ))}
            <Button size="icon" variant="outline" className="shrink-0 h-10 w-10 ml-2">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Danh sách lớp học */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredClasses.length === 0 ? (
            <div className="col-span-full py-16 text-center border-2 border-dashed border-border rounded-2xl">
              <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground">Không tìm thấy lớp học</h3>
              <p className="text-muted-foreground mt-1">Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc.</p>
            </div>
          ) : (
            filteredClasses.map((cls, i) => (
              <Link key={cls.id} href={`/student/classes/${cls.id}`} className="block group">
                <Card className="overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-border/50 animate-fade-in h-full" style={{ animationDelay: `${i * 100}ms` }}>
                  <div className="h-2 w-full" style={{ background: cls.color }} />
                  <CardHeader className="pb-3 bg-muted/10">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm transition-transform group-hover:scale-110" style={{ background: cls.color }}>
                          <BookOpen className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle className="text-base leading-snug group-hover:text-primary transition-colors">{cls.class_name}</CardTitle>
                          <p className="text-xs text-muted-foreground mt-1 font-medium">{cls.subject}</p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    <div className="flex justify-between items-center">
                      <LearningModeBadge mode={cls.learning_mode} />
                      {cls.zoom_link && <Badge variant="outline" className="border-blue-200 text-blue-600 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-400"><Video className="h-3 w-3 mr-1"/>Sẵn sàng</Badge>}
                    </div>

                    <div className="space-y-2 p-3 bg-muted/30 rounded-xl border border-border/50">
                      {cls.schedule.map((s, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs text-foreground font-medium">
                          <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span>{s.day} <span className="text-muted-foreground mx-1">·</span> {s.start_time} – {s.end_time}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-4 text-xs font-medium">
                      {cls.classroom && (
                        <span className="flex items-center gap-1.5 text-muted-foreground bg-muted/50 px-2 py-1 rounded-md"><MapPin className="h-3.5 w-3.5 text-amber-500" />{cls.classroom}</span>
                      )}
                      {cls.max_students && (
                        <span className="flex items-center gap-1.5 text-muted-foreground bg-muted/50 px-2 py-1 rounded-md"><Users className="h-3.5 w-3.5 text-blue-500" />{Math.floor(Math.random()*5)+10}/{cls.max_students}</span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 pt-2">
                      {cls.zoom_link ? (
                        <Button size="sm" variant="gradient" className="flex-1 shadow-md shadow-primary/20" onClick={(e) => e.preventDefault()}>
                          <Video className="h-3.5 w-3.5 mr-1.5" /> Tham gia Online
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" className="flex-1 border-primary/20 text-primary hover:bg-primary/5" onClick={(e) => e.preventDefault()}>
                          <MapPin className="h-3.5 w-3.5 mr-1.5" /> Lớp Offline
                        </Button>
                      )}
                      <Button size="icon" variant="outline" className="w-10 shrink-0">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </div>
      </div>
    </PortalLayout>
  );
}
