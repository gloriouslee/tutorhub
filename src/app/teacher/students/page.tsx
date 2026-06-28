"use client";

import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SectionHeader, ProgressBar } from "@/components/shared";
import { MOCK_STUDENTS } from "@/lib/mock-data";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Filter, Mail, MoreHorizontal, GraduationCap } from "lucide-react";

export default function TeacherStudentsPage() {
  return (
    <PortalLayout role="teacher" userName="Tiến sĩ Sarah Mitchell" pageTitle="Danh sách Học viên">
      <div className="space-y-6">
        <SectionHeader 
          title="Quản lý Học viên" 
          subtitle="Theo dõi tiến độ và đánh giá năng lực học tập"
        />
        
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Tìm kiếm theo tên hoặc mã học viên..." />
          </div>
          <Button variant="outline" className="shrink-0">
            <Filter className="h-4 w-4 mr-2" /> Bộ lọc
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {MOCK_STUDENTS.map((student, i) => {
            const score = [87, 79, 85, 94, 82, 70, 91, 88][i % 8];
            return (
              <Card key={student.id} className="hover:border-primary/50 transition-colors animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
                <CardContent className="p-5 flex flex-col items-center text-center">
                  <Avatar className="h-16 w-16 mb-3 border-2 border-primary/20">
                    <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                      {student.full_name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <h3 className="font-semibold text-foreground text-base truncate w-full">{student.full_name}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1 mb-4">
                    <GraduationCap className="h-3.5 w-3.5" /> Lớp: <span className="font-medium text-foreground">{student.grade}</span>
                  </div>
                  
                  <div className="w-full space-y-1.5 mb-4 text-left">
                    <div className="flex items-center justify-between text-[11px] font-medium">
                      <span className="text-muted-foreground">Điểm trung bình</span>
                      <span className={score >= 85 ? "text-emerald-600" : score >= 75 ? "text-indigo-600" : "text-amber-600"}>{score}%</span>
                    </div>
                    <ProgressBar 
                      value={score} 
                      size="sm" 
                      color={score >= 85 ? "bg-emerald-500" : score >= 75 ? "bg-indigo-500" : "bg-amber-500"} 
                    />
                  </div>
                  
                  <div className="flex items-center gap-2 w-full pt-4 border-t border-border/50">
                    <Button size="sm" variant="outline" className="flex-1 h-8 text-xs bg-muted/50">
                      <Mail className="h-3.5 w-3.5 mr-1.5" /> Gửi tin
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </PortalLayout>
  );
}
