"use client";

import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionHeader } from "@/components/shared";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageSquare, Plus, Image as ImageIcon, Paperclip, Send } from "lucide-react";

export default function TeacherAnnouncementsPage() {
  return (
    <PortalLayout role="teacher" userName="Tiến sĩ Sarah Mitchell" pageTitle="Tin tức & Thông báo">
      <div className="space-y-6 max-w-4xl mx-auto">
        <SectionHeader 
          title="Thông báo chung" 
          subtitle="Gửi thông báo và tài liệu quan trọng cho học viên của bạn"
        />

        {/* Composer */}
        <Card className="border-primary/20 shadow-sm animate-fade-in">
          <CardContent className="p-4 sm:p-6">
            <div className="flex gap-4">
              <Avatar className="h-10 w-10 shrink-0 border border-border hidden sm:flex">
                <AvatarFallback className="bg-primary/10 text-primary font-bold">SM</AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-3">
                <Input placeholder="Tiêu đề thông báo..." className="font-medium bg-muted/50 border-transparent focus-visible:bg-background" />
                <textarea 
                  className="w-full min-h-[120px] p-3 text-sm rounded-xl border border-transparent bg-muted/50 focus:bg-background focus:border-primary/30 outline-none resize-y transition-colors"
                  placeholder="Nội dung thông báo (hỗ trợ Markdown)..."
                />
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-primary">
                      <ImageIcon className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-primary">
                      <Paperclip className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button size="sm" variant="gradient" className="px-4">
                    <Send className="h-3.5 w-3.5 mr-2" /> Đăng thông báo
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Feed */}
        <div className="space-y-4">
          {[1, 2, 3].map((_, i) => (
            <Card key={i} className="animate-fade-in" style={{ animationDelay: `${(i + 1) * 150}ms` }}>
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-border">
                      <AvatarFallback className="bg-primary/10 text-primary font-bold">SM</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Tiến sĩ Sarah Mitchell</p>
                      <p className="text-xs text-muted-foreground">Toán cao cấp · {i === 0 ? "Hôm nay, 09:41" : i === 1 ? "Hôm qua, 14:20" : "12 tháng 4, 08:00"}</p>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground">
                    <MoreHorizontalIcon className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="pl-13 space-y-3">
                  <h4 className="font-semibold text-foreground">
                    {i === 0 ? "Thay đổi lịch học tuần tới" : i === 1 ? "Tài liệu ôn tập giữa kỳ" : "Kết quả bài kiểm tra số 1"}
                  </h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {i === 0 
                      ? "Chào các em, tuần sau cô có lịch công tác nên buổi học thứ 3 sẽ được chuyển sang sáng thứ 5 nhé. Các em nhớ cập nhật lịch và chuẩn bị bài trước khi đến lớp." 
                      : i === 1 
                      ? "Cô đã tải lên tài liệu ôn tập cho bài kiểm tra giữa kỳ. Các em tải về và làm các bài tập trong file đính kèm. Hạn chót nộp bài là Chủ nhật tuần này."
                      : "Điểm bài kiểm tra số 1 đã có trên hệ thống. Đa số các em làm bài khá tốt, tuy nhiên vẫn còn một số lỗi sai cơ bản. Cô sẽ chữa bài trong buổi học tới."}
                  </p>
                  
                  {i === 1 && (
                    <div className="flex items-center gap-3 p-3 mt-3 rounded-xl border border-border bg-muted/30 w-fit cursor-pointer hover:bg-muted/60 transition-colors">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                        <FileTextIcon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-foreground">Tai-lieu-on-tap-giua-ky.pdf</p>
                        <p className="text-[10px] text-muted-foreground">PDF · 2.4 MB</p>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-4 pt-3 mt-2 border-t border-border/50 text-xs font-medium text-muted-foreground">
                    <button className="flex items-center gap-1.5 hover:text-primary transition-colors">
                      <MessageSquare className="h-3.5 w-3.5" /> 
                      {i === 0 ? "12" : i === 1 ? "4" : "28"} Bình luận
                    </button>
                    <span>·</span>
                    <span>Đã xem: {150 - i * 20}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </PortalLayout>
  );
}

// Temporary inline components for icons not imported from lucide-react above
function MoreHorizontalIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </svg>
  );
}

function FileTextIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </svg>
  );
}
