"use client";

import { useState } from "react";
import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SectionHeader } from "@/components/shared";
import { MOCK_HOMEWORK, MOCK_CLASSES } from "@/lib/mock-data";
import { FileText, Plus, Calendar, CheckCircle2, Clock, X, Trash2, Edit } from "lucide-react";
import { formatDate } from "@/lib/utils";

// Modal Component for creating/editing homework
const HomeworkModal = ({ 
  isOpen, 
  onClose, 
  onSave 
}: { 
  isOpen: boolean; 
  onClose: () => void;
  onSave: (data: any) => void;
}) => {
  const [title, setTitle] = useState("");
  const [classId, setClassId] = useState("c1");
  const [dueDate, setDueDate] = useState("");
  const [desc, setDesc] = useState("");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-card w-full max-w-lg rounded-2xl shadow-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border/50 flex justify-between items-center bg-muted/30">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Giao bài tập mới
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Tiêu đề bài tập <span className="text-red-500">*</span></label>
            <Input 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              placeholder="VD: Giải tích chương 2..." 
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Chọn Lớp <span className="text-red-500">*</span></label>
              <select 
                value={classId} 
                onChange={e => setClassId(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {MOCK_CLASSES.filter(c => c.tutor_id === "t1").map(c => (
                  <option key={c.id} value={c.id}>{c.class_name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Hạn nộp <span className="text-red-500">*</span></label>
              <Input 
                type="date"
                value={dueDate} 
                onChange={e => setDueDate(e.target.value)} 
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Mô tả chi tiết</label>
            <textarea 
              value={desc}
              onChange={e => setDesc(e.target.value)}
              className="w-full min-h-[100px] p-3 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
              placeholder="Yêu cầu làm bài, lưu ý..."
            />
          </div>
        </div>
        
        <div className="p-4 border-t border-border/50 bg-muted/20 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button 
            variant="gradient" 
            onClick={() => {
              if(!title || !dueDate) return alert("Vui lòng điền đủ Tiêu đề và Hạn nộp!");
              onSave({ title, class_id: classId, due_date: dueDate, description: desc });
            }}
          >
            Đăng bài
          </Button>
        </div>
      </div>
    </div>
  );
};

export default function TeacherHomeworkPage() {
  const [homeworks, setHomeworks] = useState(MOCK_HOMEWORK);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleCreate = (data: any) => {
    const newHw = {
      id: `h${Date.now()}`,
      ...data,
      created_at: new Date().toISOString().split("T")[0],
    };
    setHomeworks([newHw, ...homeworks]);
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if(confirm("Bạn có chắc muốn xóa bài tập này không?")) {
      setHomeworks(homeworks.filter(h => h.id !== id));
    }
  };

  return (
    <PortalLayout role="teacher" userName="Tiến sĩ Sarah Mitchell" pageTitle="Quản lý Bài tập">
      <div className="space-y-6">
        <SectionHeader 
          title="Bài tập đã giao" 
          subtitle="Quản lý và chấm điểm bài tập của học viên"
          action={
            <Button size="sm" variant="gradient" onClick={() => setIsModalOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Giao bài mới
            </Button>
          }
        />
        
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {homeworks.length === 0 && (
            <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed rounded-2xl">
              Chưa có bài tập nào. Hãy "Giao bài mới" để bắt đầu!
            </div>
          )}

          {homeworks.map((hw, i) => {
            const daysLeft = Math.ceil((new Date(hw.due_date).getTime() - Date.now()) / 86400000);
            const status = daysLeft < 0 ? "Quá hạn" : daysLeft === 0 ? "Hôm nay" : "Đang mở";
            const badgeVariant = daysLeft < 0 ? "destructive" : daysLeft === 0 ? "warning" : "default";

            const relatedClass = MOCK_CLASSES.find(c => c.id === hw.class_id);

            return (
              <Card key={hw.id} className="hover:shadow-md transition-shadow animate-fade-in flex flex-col group" style={{ animationDelay: `${(i % 10) * 50}ms` }}>
                <CardHeader className="pb-3 border-b border-border/50">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-sm line-clamp-1" title={hw.title}>{hw.title}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">Lớp: {relatedClass?.class_name || hw.class_id}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant={badgeVariant as any} className="text-[10px] shrink-0">{status}</Badge>
                      <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1 text-muted-foreground hover:text-primary"><Edit className="h-3.5 w-3.5" /></button>
                        <button onClick={() => handleDelete(hw.id)} className="p-1 text-muted-foreground hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="py-4 flex-1">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>Hạn nộp: <span className="font-medium text-foreground">{formatDate(hw.due_date)}</span></span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 mt-4">
                      <div className="bg-emerald-50 dark:bg-emerald-900/20 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-800">
                        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 mb-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span className="text-[10px] font-semibold uppercase tracking-wider">Đã nộp</span>
                        </div>
                        <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                          {Math.floor(Math.random() * 10) + 1} <span className="text-xs font-normal opacity-70">/ {relatedClass?.max_students || 15}</span>
                        </p>
                      </div>
                      <div className="bg-amber-50 dark:bg-amber-900/20 p-2.5 rounded-xl border border-amber-100 dark:border-amber-800">
                        <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 mb-1">
                          <Clock className="h-3.5 w-3.5" />
                          <span className="text-[10px] font-semibold uppercase tracking-wider">Chưa chấm</span>
                        </div>
                        <p className="text-lg font-bold text-amber-700 dark:text-amber-300">
                          {Math.floor(Math.random() * 3) + 1}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="pt-0 pb-4 px-4">
                  <Button variant="outline" className="w-full text-xs h-8 hover:bg-primary/5 hover:text-primary hover:border-primary/50 transition-colors">
                    Xem chi tiết & Chấm bài
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>

      <HomeworkModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={handleCreate} 
      />
    </PortalLayout>
  );
}
