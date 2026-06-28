"use client";

import { useState, useEffect } from "react";
import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/shared";
import { 
  STUDENT_SCORE_DATA, 
  MOCK_EXAM_SCORES, 
  MOCK_STUDENTS 
} from "@/lib/mock-data";
import { getStudentComments } from "@/lib/storage";
import { 
  TrendingUp, Target, Brain, Award, Calendar, 
  BarChart3, ChevronDown, BookOpen, Star, FileText 
} from "lucide-react";
import { 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, 
  Tooltip, CartesianGrid, Radar, RadarChart, PolarGrid, 
  PolarAngleAxis, PolarRadiusAxis, Area, AreaChart
} from "recharts";

// Simulate progress trend over months for the line chart
const TREND_DATA = [
  { month: "T1", score: 7.5 },
  { month: "T2", score: 7.8 },
  { month: "T3", score: 8.2 },
  { month: "T4", score: 8.5 },
  { month: "T5", score: 9.1 },
];

export default function ParentProgressPage() {
  // Parent "p1" has students "s1" and "s4"
  const children = MOCK_STUDENTS.filter(s => s.parent_id === "p1");
  const [selectedChild, setSelectedChild] = useState(children[0]);
  const [latestComment, setLatestComment] = useState<any | null>(null);

  useEffect(() => {
    async function loadLatestComment() {
      if (selectedChild) {
        const studentComments = await getStudentComments(selectedChild.id);
        if (studentComments.length > 0) {
          const sorted = [...studentComments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          setLatestComment(sorted[0]);
        } else {
          setLatestComment(null);
        }
      }
    }
    loadLatestComment();
  }, [selectedChild]);

  // Exams for selected child
  const childExams = MOCK_EXAM_SCORES.filter(e => e.student_id === selectedChild?.id);

  return (
    <PortalLayout role="parent" userName="Trần Văn Minh" pageTitle="Tiến độ học tập">
      <div className="space-y-8 max-w-6xl mx-auto pb-10">
        <SectionHeader 
          title="Tiến độ học tập" 
          subtitle="Theo dõi kết quả và đánh giá năng lực của con"
        />

        {/* Child Selector & Quick Stats */}
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <div className="w-full md:w-1/3 space-y-6">
            {/* Child Selector */}
            <Card className="border-0 shadow-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white overflow-hidden relative">
              <div className="absolute top-0 right-0 p-6 opacity-10">
                <Brain className="w-32 h-32" />
              </div>
              <CardContent className="p-6 relative z-10">
                <p className="text-indigo-100 text-sm font-medium mb-1">Đang xem báo cáo của</p>
                <div className="relative">
                  <select 
                    className="w-full appearance-none bg-white/20 border border-white/30 text-white text-lg font-bold rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-white/50 cursor-pointer"
                    value={selectedChild?.id}
                    onChange={(e) => setSelectedChild(children.find(c => c.id === e.target.value) || children[0])}
                  >
                    {children.map(child => (
                      <option key={child.id} value={child.id} className="text-gray-900">
                        {child.full_name} ({child.grade})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 pointer-events-none opacity-70" />
                </div>
                
                <div className="mt-6 flex items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center border-2 border-white/40 shadow-inner">
                    <span className="text-2xl font-black">{selectedChild?.full_name.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">8.8</p>
                    <p className="text-xs text-indigo-100 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" /> Điểm trung bình (Tháng này)
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="border-0 shadow-sm bg-card hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                  <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 flex items-center justify-center">
                    <Target className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">Top 5%</p>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Xếp hạng lớp</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-card hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                  <div className="h-10 w-10 rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30 flex items-center justify-center">
                    <Award className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">12</p>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Huy hiệu đạt được</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Charts Area */}
          <div className="w-full md:w-2/3 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Trend Chart */}
            <Card className="border-0 shadow-sm col-span-1 md:col-span-2 overflow-hidden">
              <CardHeader className="pb-2 border-b border-border/50 bg-muted/20">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" /> Phổ điểm qua các tháng
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 pt-8 h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={TREND_DATA} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#888888" opacity={0.2} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} dy={10} />
                    <YAxis domain={[5, 10]} axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
                      cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 4' }}
                    />
                    <Area type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorScore)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Radar Chart for Subjects */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2 border-b border-border/50 bg-muted/20">
                <CardTitle className="text-base flex items-center gap-2">
                  <Star className="h-4 w-4 text-amber-500" /> Năng lực theo môn học
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 h-[250px] flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={STUDENT_SCORE_DATA}>
                    <PolarGrid stroke="#888888" opacity={0.2} />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#888888', fontSize: 11, fontWeight: 'bold' }} />
                    <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
                    <Radar name="Điểm số" dataKey="score" stroke="#8b5cf6" strokeWidth={2} fill="#8b5cf6" fillOpacity={0.5} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Teacher Feedback Note */}
            <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-900/10 border border-amber-100 dark:border-amber-900/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-500">
                  <FileText className="h-4 w-4" /> Nhận xét từ Giáo viên
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-white/60 dark:bg-black/20 p-4 rounded-xl text-sm leading-relaxed text-foreground relative">
                    <span className="text-4xl text-amber-300 absolute top-2 left-2 opacity-50 font-serif">"</span>
                    <p className="relative z-10 pl-4">
                      {latestComment ? latestComment.text : `Em ${selectedChild?.full_name.split(' ').pop()} có thái độ học tập tích cực và luôn hoàn thành bài tập đầy đủ. Cần rèn luyện thêm kỹ năng làm toán cẩn thận.`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium justify-end">
                    <span>{latestComment ? `— Ngày ${latestComment.date} (Đánh giá: ${"★".repeat(latestComment.rating)})` : "— Thầy Hùng Toán"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Recent Exams List */}
        <div className="mt-8 animate-fade-in delay-200">
          <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
            <BookOpen className="h-5 w-5 text-primary" /> Kết quả bài thi gần đây
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {childExams.length > 0 ? childExams.map((exam, i) => {
              const scorePercent = (exam.score / exam.max_score) * 100;
              let scoreColor = "text-emerald-600";
              let badgeColor = "bg-emerald-100 text-emerald-700";
              if (scorePercent < 50) {
                scoreColor = "text-red-600";
                badgeColor = "bg-red-100 text-red-700";
              } else if (scorePercent < 80) {
                scoreColor = "text-amber-600";
                badgeColor = "bg-amber-100 text-amber-700";
              }

              return (
                <Card key={exam.id} className="border border-border/50 shadow-sm hover:shadow-md transition-shadow group">
                  <CardContent className="p-5">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <Badge className={`text-[10px] font-bold border-0 mb-2 ${badgeColor}`}>
                          {exam.score >= 8 ? "Giỏi" : exam.score >= 6.5 ? "Khá" : "Cần cố gắng"}
                        </Badge>
                        <h4 className="font-bold text-foreground leading-tight line-clamp-1 group-hover:text-primary transition-colors">{exam.exam_name}</h4>
                      </div>
                      <div className="text-right">
                        <span className={`text-2xl font-black ${scoreColor}`}>{exam.score}</span>
                        <span className="text-xs text-muted-foreground font-medium">/{exam.max_score}</span>
                      </div>
                    </div>
                    
                    <div className="w-full bg-muted rounded-full h-1.5 mb-3 overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${scorePercent >= 80 ? 'bg-emerald-500' : scorePercent >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} 
                        style={{ width: `${scorePercent}%` }} 
                      />
                    </div>
                    
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground font-medium">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(exam.exam_date).toLocaleDateString('vi-VN')}</span>
                      <Button variant="link" className="h-auto p-0 text-[11px]">Xem bài giải &rarr;</Button>
                    </div>
                  </CardContent>
                </Card>
              );
            }) : (
              <div className="col-span-full p-8 text-center bg-muted/30 border border-dashed rounded-xl text-muted-foreground">
                <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p>Chưa có dữ liệu điểm thi cho học viên này.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </PortalLayout>
  );
}
