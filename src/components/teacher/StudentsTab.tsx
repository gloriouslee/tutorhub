"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ProgressBar } from "@/components/shared";
import { type StudentPackage } from "@/lib/storage";
import { Users, Plus, Trash2, MessageSquare } from "lucide-react";
import { PACKAGE_TYPES } from "./classDetail.types";

export default function StudentsTab({
  classStudents,
  studentSearch,
  setStudentSearch,
  comments,
  onAddStudent,
  onSetPackage,
  onOpenComment,
  onRemoveStudent,
}: {
  classStudents: any[];
  studentSearch: string;
  setStudentSearch: (v: string) => void;
  comments: Record<string, { text: string; date: string; rating: number }[]>;
  onAddStudent: () => void;
  onSetPackage: (studentId: string, pkg: StudentPackage) => void;
  onOpenComment: (student: any) => void;
  onRemoveStudent: (student: any) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-bold text-foreground">Danh sách học viên</h3>
          <p className="text-sm text-muted-foreground">Quản lý và theo dõi tiến độ của {classStudents.length} học viên</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Input
              placeholder="Tìm tên học viên..."
              className="pl-9"
              value={studentSearch}
              onChange={e => setStudentSearch(e.target.value)}
            />
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
          <Button variant="outline" onClick={onAddStudent}><Plus className="h-4 w-4 mr-2" /> Thêm học viên</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(PACKAGE_TYPES).map(([key, info]) => (
          <Card key={key} className="bg-card/50">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`h-2 w-2 rounded-full ${info.color.split(" ")[1]}`} />
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">{info.label}</p>
                  <p className="text-sm font-semibold">{classStudents.filter(s => s.package === key).length} học viên</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="rounded-2xl border border-border overflow-hidden bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Học viên</th>
                <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Gói đăng ký</th>
                <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-center">Tiến độ</th>
                <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {classStudents.filter(s => !studentSearch || s.full_name.toLowerCase().includes(studentSearch.toLowerCase())).map(student => (
                <tr key={student.id} className="hover:bg-muted/30 transition-colors group">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {student.full_name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-foreground">{student.full_name}</p>
                          {comments[student.id]?.length > 0 && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 border-emerald-200">
                              {comments[student.id].length} nhận xét
                            </Badge>
                          )}
                        </div>
                        {(student.school || student.grade) && (
                          <p className="text-[11px] text-muted-foreground">
                            {[student.school, student.grade].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex gap-1 flex-wrap">
                        {(["online", "advanced", "offline"] as StudentPackage[]).map(pkg => (
                          <button
                            key={pkg}
                            onClick={() => onSetPackage(student.id, pkg)}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all ${student.package === pkg ? `${PACKAGE_TYPES[pkg].color} border-transparent` : "border-border text-muted-foreground hover:border-primary/40"}`}
                          >
                            {PACKAGE_TYPES[pkg].label}
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground italic">{PACKAGE_TYPES[student.package].description}</p>
                    </div>
                  </td>
                  <td className="p-4 min-w-[150px]">
                    {student.progress == null ? (
                      <p className="text-center text-xs text-muted-foreground">—</p>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px] font-medium">
                          <span className="text-muted-foreground">Hoàn thành</span>
                          <span className="text-primary">{student.progress}%</span>
                        </div>
                        <ProgressBar value={student.progress} className="h-1.5" />
                      </div>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="sm" variant="outline" onClick={() => onOpenComment(student)}
                        className="text-xs h-8 flex items-center gap-1 hover:bg-primary/5 hover:text-primary transition-all font-semibold">
                        <MessageSquare className="h-3.5 w-3.5" /> Nhận xét
                      </Button>
                      <Button size="icon" variant="ghost" title="Xóa khỏi lớp" onClick={() => onRemoveStudent(student)}
                        className="h-8 w-8 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
