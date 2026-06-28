"use client";

import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/shared";
import { MOCK_STUDENTS, MOCK_HOMEWORK } from "@/lib/mock-data";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, CheckCircle2, Clock, FileText, Download } from "lucide-react";

export default function TeacherSubmissionsPage() {
  return (
    <PortalLayout role="teacher" userName="Tiến sĩ Sarah Mitchell" pageTitle="Quản lý Bài nộp">
      <div className="space-y-6">
        <SectionHeader 
          title="Chấm bài & Phản hồi" 
          subtitle="Quản lý bài nộp của học viên cho các bài tập đã giao"
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {MOCK_HOMEWORK.slice(0, 2).map((hw, index) => (
              <div key={hw.id} className="space-y-3 animate-fade-in" style={{ animationDelay: `${index * 150}ms` }}>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-foreground">{hw.title}</h3>
                </div>
                
                {MOCK_STUDENTS.slice(index * 3, index * 3 + 3).map((student, i) => {
                  const isGraded = i === 0;
                  const score = isGraded ? Math.floor(Math.random() * 10) + 85 : null;
                  
                  return (
                    <Card key={student.id} className="hover:border-primary/30 transition-colors">
                      <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
                        <div className="flex items-center gap-3 min-w-[200px]">
                          <Avatar size="sm">
                            <AvatarFallback>{student.full_name[0]}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium text-foreground">{student.full_name}</p>
                            <p className="text-xs text-muted-foreground">Nộp lúc: Hôm qua, 14:30</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4 w-full sm:w-auto">
                          {isGraded ? (
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-100 dark:border-emerald-800">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">{score}/100</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-100 dark:border-amber-800">
                              <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                              <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">Chưa chấm</span>
                            </div>
                          )}
                          
                          <div className="flex items-center gap-2 shrink-0">
                            <Button size="icon" variant="outline" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant={isGraded ? "outline" : "gradient"} className="h-8 text-xs">
                              {isGraded ? "Sửa điểm" : "Chấm bài"}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ))}
          </div>
          
          <div className="space-y-4 animate-fade-in delay-300">
            <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
              <CardContent className="p-5">
                <h3 className="font-semibold text-foreground mb-4">Tiến độ chấm bài</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Toán cao cấp</span>
                      <span className="font-medium">18/24</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary w-[75%]" />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Vật lý đại cương</span>
                      <span className="font-medium">5/20</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 w-[25%]" />
                    </div>
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
