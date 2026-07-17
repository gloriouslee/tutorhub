"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit3, Trash2, CheckSquare, Users, ChevronDown, ChevronUp } from "lucide-react";
import { formatDate, dueStatus, type Homework, type Submission } from "./classDetail.types";

interface Student {
  id: string;
  full_name: string;
}

export default function HomeworkTab({
  homeworks,
  submissions,
  students = [],
  onNewHomework,
  onEditHomework,
  onDeleteHomework,
}: {
  homeworks: Homework[];
  submissions: Submission[];
  students?: Student[];
  onNewHomework: () => void;
  onEditHomework: (hw: Homework) => void;
  onDeleteHomework: (id: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-bold text-foreground">Bài tập</h3>
          <p className="text-sm text-muted-foreground">{homeworks.length} bài tập đã giao cho lớp này</p>
        </div>
        <Button variant="gradient" onClick={onNewHomework}>
          <Plus className="h-4 w-4 mr-2" />Giao bài mới
        </Button>
      </div>

      {homeworks.length === 0 && (
        <Card>
          <CardContent className="p-10 text-center">
            <CheckSquare className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Chưa có bài tập nào. Hãy giao bài tập đầu tiên!</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {homeworks.map((hw, i) => {
          const status = dueStatus(hw.due_date);
          const hwSubmissions = submissions.filter(s => s.homework_id === hw.id);
          const gradedCount = hwSubmissions.filter(s => (s as any).score !== undefined && (s as any).score !== null).length;
          const isExpanded = expandedId === hw.id;

          return (
            <Card key={hw.id} className="hover:shadow-md transition-all animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
              <CardContent className="p-5">
                {/* Header row — click to toggle */}
                <div
                  className="flex flex-col sm:flex-row sm:items-start gap-4 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : hw.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${status.color}`}>{status.label}</span>
                      <span className="text-xs text-muted-foreground">Hạn: {formatDate(hw.due_date)}</span>
                    </div>
                    <h3 className="font-semibold text-foreground">{hw.title}</h3>
                    {hw.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{hw.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>{hwSubmissions.length} nộp bài</span>
                      {gradedCount > 0 && <span className="text-emerald-600">{gradedCount} đã chấm</span>}
                      <span>Tạo: {formatDate(hw.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {students.length > 0 && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </span>
                    )}
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground"
                      onClick={e => { e.stopPropagation(); onEditHomework(hw); }}>
                      <Edit3 className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:bg-red-50"
                      onClick={e => { e.stopPropagation(); onDeleteHomework(hw.id); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Expandable student summary */}
                {isExpanded && students.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border/50">
                    {/* Legend */}
                    <div className="flex flex-wrap gap-4 mb-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><span>✅</span> Đã chấm</span>
                      <span className="flex items-center gap-1"><span>⏳</span> Đã nộp, chờ chấm</span>
                      <span className="flex items-center gap-1"><span>❌</span> Chưa nộp</span>
                    </div>

                    <div className="space-y-2">
                      {students.map(student => {
                        const sub = submissions.find(s => s.homework_id === hw.id && s.student_id === student.id);
                        const isGraded = sub && (sub as any).score !== undefined && (sub as any).score !== null;
                        const isSubmitted = !!sub;

                        return (
                          <div key={student.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30">
                            <span className="text-sm font-medium text-foreground">{student.full_name}</span>
                            <div className="flex items-center gap-2">
                              {isGraded ? (
                                <>
                                  <span className="text-base">✅</span>
                                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">
                                    {(sub as any).score} điểm
                                  </span>
                                </>
                              ) : isSubmitted ? (
                                <>
                                  <span className="text-base">⏳</span>
                                  <span className="text-xs text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">Chờ chấm</span>
                                </>
                              ) : (
                                <>
                                  <span className="text-base">❌</span>
                                  <span className="text-xs text-red-600 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded-full">Chưa nộp</span>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
