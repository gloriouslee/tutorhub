"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit3, Trash2, CheckSquare } from "lucide-react";
import { formatDate, dueStatus, type Homework, type Submission } from "./classDetail.types";

export default function HomeworkTab({
  homeworks,
  submissions,
  onNewHomework,
  onEditHomework,
  onDeleteHomework,
}: {
  homeworks: Homework[];
  submissions: Submission[];
  onNewHomework: () => void;
  onEditHomework: (hw: Homework) => void;
  onDeleteHomework: (id: string) => void;
}) {
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
          return (
            <Card key={hw.id} className="hover:shadow-md transition-all animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
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
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground"
                      onClick={() => onEditHomework(hw)}>
                      <Edit3 className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:bg-red-50"
                      onClick={() => onDeleteHomework(hw.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
