"use client";

import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/shared";
import { MOCK_HOMEWORK, MOCK_SUBMISSIONS, MOCK_CLASSES } from "@/lib/mock-data";
import { FileText, Clock, CheckCircle2, Upload, Calendar, AlertCircle, X, Check, Download } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useState } from "react";

export default function StudentHomeworkPage() {
  const [localSubmissions, setLocalSubmissions] = useState(MOCK_SUBMISSIONS);
  const [selectedHw, setSelectedHw] = useState<any>(null);
  const [modalType, setModalType] = useState<"submit" | "detail" | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCloseModal = () => {
    setSelectedHw(null);
    setModalType(null);
    setFile(null);
  };

  const handleSubmitHomework = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !selectedHw) return;
    
    setIsSubmitting(true);
    setTimeout(() => {
      // Create a mock submission
      const newSubmission: any = {
        id: `sub-${Date.now()}`,
        homework_id: selectedHw.id,
        student_id: "s1",
        status: "submitted" as const,
        submitted_at: new Date().toISOString(),
        file_url: null,
        score: null,
        feedback: null
      };
      
      setLocalSubmissions(prev => [...prev, newSubmission]);
      setIsSubmitting(false);
      handleCloseModal();
    }, 1500);
  };

  return (
    <PortalLayout role="student" userName="Nguyễn Anh Tuấn" pageTitle="Bài tập">
      <div className="space-y-6 max-w-5xl mx-auto pb-10">
        <SectionHeader 
          title="Bài tập của tôi" 
          subtitle="Quản lý và nộp bài tập đúng hạn"
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {MOCK_HOMEWORK.map((hw, i) => {
              const submission = localSubmissions.find(s => s.homework_id === hw.id && s.student_id === "s1");
              const daysLeft = Math.ceil((new Date(hw.due_date).getTime() - Date.now()) / 86400000);
              const relatedClass = MOCK_CLASSES.find(c => c.id === hw.class_id);
              
              let statusText = "Chưa nộp";
              let badgeVariant: any = "destructive";
              let Icon = Clock;
              
              if (submission) {
                if (submission.status === "graded") {
                  statusText = `Đã chấm: ${submission.score}/100`;
                  badgeVariant = "default";
                  Icon = CheckCircle2;
                } else {
                  statusText = "Đã nộp";
                  badgeVariant = "warning";
                  Icon = CheckCircle2;
                }
              } else if (daysLeft > 0) {
                statusText = `Còn ${daysLeft} ngày`;
                badgeVariant = daysLeft <= 2 ? "warning" : "outline";
                if(daysLeft <= 2) Icon = AlertCircle;
              } else {
                statusText = "Quá hạn";
                badgeVariant = "destructive";
                Icon = AlertCircle;
              }

              return (
                <Card key={hw.id} className="hover:border-primary/40 transition-colors animate-fade-in group" style={{ animationDelay: `${i * 100}ms` }}>
                  <CardContent className="p-5 flex flex-col sm:flex-row gap-5">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <FileText className="h-6 w-6" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-start justify-between gap-2 mb-1.5">
                        <h3 className="font-semibold text-foreground text-lg group-hover:text-primary transition-colors">{hw.title}</h3>
                        <Badge variant={badgeVariant} className="flex items-center gap-1">
                          <Icon className="h-3 w-3" /> {statusText}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                        <span className="bg-muted px-2 py-0.5 rounded-md font-medium text-foreground">{relatedClass?.class_name || "Lớp học"}</span>
                        <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Hạn nộp: {formatDate(hw.due_date)}</span>
                      </div>
                      
                      <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                        {hw.description}
                      </p>

                      {submission?.feedback && (
                        <div className="mt-4 p-3 bg-muted/40 rounded-lg border border-border/50 text-sm">
                          <span className="font-semibold text-primary block mb-1">Nhận xét của Giáo viên:</span>
                          <span className="text-foreground italic">"{submission.feedback}"</span>
                        </div>
                      )}
                      
                      <div className="mt-5 pt-4 border-t border-border flex gap-3">
                        {!submission ? (
                          <Button 
                            variant="gradient" 
                            className="w-full sm:w-auto font-semibold"
                            onClick={() => { setSelectedHw(hw); setModalType("submit"); }}
                          >
                            <Upload className="h-4 w-4 mr-2" /> Nộp bài ngay
                          </Button>
                        ) : (
                          <Button variant="outline" className="w-full sm:w-auto font-semibold">
                            <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-500" /> Đã nộp
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          className="w-full sm:w-auto text-muted-foreground hover:text-foreground font-semibold"
                          onClick={() => { setSelectedHw(hw); setModalType("detail"); }}
                        >
                          Chi tiết
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="space-y-6">
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <CardContent className="p-6">
                <h3 className="font-bold text-lg mb-2">Tiến độ bài tập</h3>
                <p className="text-sm text-muted-foreground mb-6">Bạn đã hoàn thành rất tốt trong tuần này!</p>
                
                <div className="space-y-5">
                  <div>
                    <div className="flex justify-between text-sm mb-2 font-medium">
                      <span>Đã nộp</span>
                      <span className="text-primary">3/4 bài</span>
                    </div>
                    <div className="h-2 w-full bg-background rounded-full overflow-hidden border border-border/50">
                      <div className="h-full bg-primary w-[75%] rounded-full" />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2 font-medium">
                      <span>Điểm trung bình</span>
                      <span className="text-emerald-500">90/100</span>
                    </div>
                    <div className="h-2 w-full bg-background rounded-full overflow-hidden border border-border/50">
                      <div className="h-full bg-emerald-500 w-[90%] rounded-full" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5 flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                  <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">Sắp đến hạn</h4>
                  <p className="text-sm text-muted-foreground mt-0.5">Bạn có 1 bài tập Toán cao cấp cần nộp vào ngày mai.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Modals */}
      {modalType && selectedHw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-lg shadow-2xl border-0 overflow-hidden">
            <div className="bg-card border-b border-border p-6 flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-foreground mb-1">
                  {modalType === "submit" ? "Nộp bài tập" : "Chi tiết bài tập"}
                </h3>
                <p className="text-muted-foreground text-sm font-medium line-clamp-1">{selectedHw.title}</p>
              </div>
              <Button size="icon" variant="ghost" className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-full h-8 w-8 -mt-2 -mr-2" onClick={handleCloseModal}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            <CardContent className="p-6">
              {modalType === "detail" && (() => {
                const relatedClass = MOCK_CLASSES.find(c => c.id === selectedHw.class_id);
                const submission = localSubmissions.find(s => s.homework_id === selectedHw.id && s.student_id === "s1");
                return (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 bg-primary/5 p-3 rounded-xl border border-primary/10">
                      <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Môn học / Lớp</p>
                        <p className="font-semibold text-sm text-foreground">{relatedClass?.class_name || "Lớp chung"}</p>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">Yêu cầu chi tiết</h4>
                      <div className="bg-muted/20 p-4 rounded-xl text-sm leading-relaxed text-foreground border border-border min-h-[100px]">
                        {selectedHw.description}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">Tệp đính kèm từ Giáo viên</h4>
                      <div className="flex items-center justify-between bg-card p-3 rounded-xl border border-border shadow-sm hover:border-primary/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-lg flex items-center justify-center shrink-0">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-foreground truncate">de_bai_chinh_thuc.pdf</p>
                            <p className="text-xs text-muted-foreground font-medium">1.2 MB • Cập nhật: {formatDate(selectedHw.created_at || "2024-09-01")}</p>
                          </div>
                        </div>
                        <Button variant="outline" size="icon" className="shrink-0 h-9 w-9 rounded-full">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-muted/20 p-3 rounded-xl border border-border flex items-center gap-3">
                        <div className="h-8 w-8 bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 rounded-md flex items-center justify-center shrink-0">
                          <Calendar className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground block font-medium">Hạn nộp</span>
                          <span className="font-semibold text-sm text-foreground">{formatDate(selectedHw.due_date)}</span>
                        </div>
                      </div>
                      <div className="bg-muted/20 p-3 rounded-xl border border-border flex items-center gap-3">
                        <div className="h-8 w-8 bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-md flex items-center justify-center shrink-0">
                          <CheckCircle2 className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground block font-medium">Trạng thái</span>
                          <span className={`font-semibold text-sm ${submission ? "text-emerald-500" : "text-amber-500"}`}>
                            {submission ? "Đã nộp" : "Chưa nộp"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {submission && (
                      <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/50">
                        <h4 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-2">
                          <Check className="h-4 w-4" /> Đã nộp thành công
                        </h4>
                        <p className="text-xs text-muted-foreground mb-3">Vào lúc {formatDate(submission.submitted_at || new Date().toISOString())}</p>
                        {submission.feedback && (
                          <div className="bg-white dark:bg-card p-3 rounded-lg border border-border text-sm">
                            <span className="font-bold block mb-1">Nhận xét của giáo viên:</span>
                            <span className="italic">"{submission.feedback}"</span>
                            {submission.score && (
                              <div className="mt-2 text-primary font-bold">Điểm: {submission.score}/100</div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {!submission && (
                      <div className="pt-2">
                        <Button variant="gradient" className="w-full font-bold h-11 shadow-sm" onClick={() => setModalType("submit")}>
                          Đến trang Nộp bài <Upload className="h-4 w-4 ml-2" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })()}

              {modalType === "submit" && (
                <form onSubmit={handleSubmitHomework} className="space-y-6">
                  <div className="space-y-3">
                    <label className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${file ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                      <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                        {file ? (
                          <>
                            <CheckCircle2 className="w-10 h-10 text-primary mb-3" />
                            <p className="text-sm font-bold text-primary truncate max-w-full">{file.name}</p>
                            <p className="text-xs text-primary/70 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                          </>
                        ) : (
                          <>
                            <Upload className="w-10 h-10 text-muted-foreground mb-3" />
                            <p className="text-sm text-foreground font-medium mb-1"><span className="text-primary font-bold">Nhấn để chọn</span> hoặc kéo thả file</p>
                            <p className="text-xs text-muted-foreground">PDF, DOCX, ZIP (Tối đa 10MB)</p>
                          </>
                        )}
                      </div>
                      <input type="file" className="hidden" onChange={(e) => {
                        if (e.target.files && e.target.files[0]) setFile(e.target.files[0]);
                      }} />
                    </label>
                  </div>
                  
                  <div className="flex justify-end gap-3 pt-2 border-t border-border">
                    <Button type="button" variant="ghost" onClick={handleCloseModal}>Hủy</Button>
                    <Button type="submit" variant="gradient" disabled={!file || isSubmitting} className="min-w-[120px]">
                      {isSubmitting ? (
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Đang tải...
                        </span>
                      ) : "Xác nhận nộp bài"}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </PortalLayout>
  );
}
