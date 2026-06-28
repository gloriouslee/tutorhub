"use client";

import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SectionHeader, ProgressBar } from "@/components/shared";
import { MOCK_EXAM_SCORES, MOCK_CLASSES } from "@/lib/mock-data";
import { GraduationCap, TrendingUp, Trophy, Target, BookOpen } from "lucide-react";
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip } from "recharts";

export default function StudentScoresPage() {
  const studentScores = MOCK_EXAM_SCORES.filter(score => score.student_id === "s1");

  const averageScore = Number((
    studentScores.reduce((acc, curr) => acc + curr.score, 0) / studentScores.length
  ).toFixed(1));

  const radarData = [
    { subject: "Đại Số", score: 8.7, fullMark: 10 },
    { subject: "Hình Học", score: 9.1, fullMark: 10 },
    { subject: "Giải Tích", score: 8.5, fullMark: 10 },
    { subject: "Xác Suất", score: 8.8, fullMark: 10 },
    { subject: "Số Học", score: 8.2, fullMark: 10 },
  ];

  return (
    <PortalLayout role="student" userName="Nguyễn Anh Tuấn" pageTitle="Kết quả học tập">
      <div className="space-y-6 max-w-6xl mx-auto">
        <SectionHeader 
          title="Bảng điểm cá nhân" 
          subtitle="Theo dõi thành tích và đánh giá năng lực qua các kỳ thi"
        />

        {/* Top Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-0 shadow-lg animate-fade-in">
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex justify-between items-start mb-4">
                <p className="text-white/80 font-medium text-sm">Điểm Trung Bình</p>
                <div className="p-2 bg-white/20 rounded-lg"><Trophy className="h-4 w-4" /></div>
              </div>
              <h2 className="text-4xl font-black">{averageScore}<span className="text-xl text-white/70 font-normal">/10</span></h2>
              <p className="text-xs text-emerald-300 mt-2 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> +2.4% so với học kỳ trước
              </p>
            </CardContent>
          </Card>
          
          <Card className="animate-fade-in delay-100">
            <CardContent className="p-5 h-full flex flex-col justify-between">
              <div className="flex justify-between items-start mb-4">
                <p className="text-muted-foreground font-medium text-sm">Tổng bài thi</p>
                <div className="p-2 bg-primary/10 text-primary rounded-lg"><BookOpen className="h-4 w-4" /></div>
              </div>
              <h2 className="text-4xl font-bold">{studentScores.length}</h2>
              <p className="text-xs text-muted-foreground mt-2">Hoàn thành 100% mục tiêu</p>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 animate-fade-in delay-200 bg-card">
            <CardContent className="p-0 h-full flex items-center">
              <div className="flex-1 p-5 border-r border-border">
                <h3 className="font-semibold mb-1 flex items-center gap-2">
                  <Target className="h-4 w-4 text-amber-500" /> Mục tiêu GPA
                </h3>
                <p className="text-2xl font-bold text-foreground mb-3">9.0</p>
                <ProgressBar value={(averageScore / 10) * 100} size="sm" color="bg-amber-500" />
                <p className="text-[10px] text-muted-foreground mt-2">Còn thiếu 0.3 điểm để đạt mục tiêu Học bổng.</p>
              </div>
              <div className="w-1/3 p-4 flex justify-center">
                <div className="h-24 w-24 rounded-full border-4 border-primary/20 flex items-center justify-center relative">
                  <span className="text-2xl font-bold text-primary">A+</span>
                  <div className="absolute inset-[-4px] border-4 border-primary rounded-full border-t-transparent border-l-transparent rotate-45" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          {/* List of Scores */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="font-bold text-lg">Chi tiết điểm thi</h3>
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="grid grid-cols-12 gap-4 p-4 border-b border-border bg-muted/30 font-semibold text-sm text-muted-foreground">
                <div className="col-span-5">Môn học / Kỳ thi</div>
                <div className="col-span-3 text-center">Ngày thi</div>
                <div className="col-span-2 text-center">Điểm số</div>
                <div className="col-span-2 text-right">Đánh giá</div>
              </div>
              
              <div className="divide-y divide-border/50">
                {studentScores.map((score, i) => {
                  const relatedClass = MOCK_CLASSES.find(c => c.id === score.class_id);
                  const scorePercentage = (score.score / score.max_score) * 100;
                  
                  let badgeVariant: any = "default";
                  let grade = "Giỏi";
                  if (scorePercentage < 50) { badgeVariant = "destructive"; grade = "Yếu"; }
                  else if (scorePercentage < 70) { badgeVariant = "warning"; grade = "Khá"; }
                  else if (scorePercentage >= 90) { badgeVariant = "secondary"; grade = "Xuất sắc"; }

                  return (
                    <div key={score.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-muted/20 transition-colors animate-fade-in" style={{ animationDelay: `${i * 100}ms` }}>
                      <div className="col-span-5 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <GraduationCap className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-foreground">{score.exam_name}</p>
                          <p className="text-xs text-muted-foreground">{relatedClass?.class_name || "Lớp học"}</p>
                        </div>
                      </div>
                      <div className="col-span-3 text-center text-xs text-muted-foreground">
                        {score.exam_date}
                      </div>
                      <div className="col-span-2 text-center">
                        <span className="font-bold text-base">{score.score}</span>
                        <span className="text-xs text-muted-foreground">/{score.max_score}</span>
                      </div>
                      <div className="col-span-2 text-right">
                        <Badge variant={badgeVariant} className="text-[10px] font-semibold">{grade}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Radar Chart */}
          <div className="space-y-4">
            <h3 className="font-bold text-lg">Phân tích Năng lực</h3>
            <Card className="h-[360px] flex items-center justify-center border-border shadow-sm">
              <CardContent className="w-full h-full p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                    <PolarGrid stroke="rgb(var(--border))" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgb(var(--foreground))', fontSize: 12, fontWeight: 500 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'rgb(var(--card))', borderRadius: '8px', border: '1px solid rgb(var(--border))' }}
                      itemStyle={{ color: 'rgb(var(--primary))', fontWeight: 'bold' }}
                    />
                    <Radar name="Tuấn" dataKey="score" stroke="rgb(var(--primary))" fill="rgb(var(--primary))" fillOpacity={0.4} />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
