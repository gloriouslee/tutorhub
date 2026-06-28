"use client";

import { useState } from "react";
import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/shared";
import { MOCK_STUDENTS, MOCK_CLASSES } from "@/lib/mock-data";
import { Calendar, Clock, MapPin, Video, ChevronLeft, ChevronRight, Filter } from "lucide-react";

const DAYS_OF_WEEK = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"];

const mapDay = (day: string) => {
  const map: Record<string, string> = {
    "Monday": "Thứ Hai", "Tuesday": "Thứ Ba", "Wednesday": "Thứ Tư",
    "Thursday": "Thứ Năm", "Friday": "Thứ Sáu", "Saturday": "Thứ Bảy", "Sunday": "Chủ Nhật"
  };
  return map[day] || day;
};

// Map children to classes for mock data purposes
const getClassesForChild = (childId: string) => {
  if (childId === "s1") return [MOCK_CLASSES[0], MOCK_CLASSES[1]]; // Toán 12, Lý 12
  if (childId === "s4") return [MOCK_CLASSES[2]]; // Hóa 12
  return [];
};

export default function ParentSchedulePage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedChildId, setSelectedChildId] = useState<string>("all");

  const children = MOCK_STUDENTS.filter(s => s.parent_id === "p1");
  const childColors: Record<string, string> = {
    "s1": "from-indigo-500 to-purple-600",
    "s4": "from-teal-500 to-emerald-600",
  };
  const childHexColors: Record<string, string> = {
    "s1": "#6366f1",
    "s4": "#14b8a6",
  };

  const scheduleByDay: Record<string, any[]> = {};
  DAYS_OF_WEEK.forEach(day => { scheduleByDay[day] = []; });

  children.forEach(child => {
    if (selectedChildId === "all" || selectedChildId === child.id) {
      const classes = getClassesForChild(child.id);
      classes.forEach(cls => {
        cls.schedule.forEach(slot => {
          const vDay = mapDay(slot.day);
          if (scheduleByDay[vDay]) {
            scheduleByDay[vDay].push({ 
              ...cls, 
              start_time: slot.start_time, 
              end_time: slot.end_time,
              child: child 
            });
          }
        });
      });
    }
  });

  Object.keys(scheduleByDay).forEach(day => {
    scheduleByDay[day].sort((a, b) => a.start_time.localeCompare(b.start_time));
  });

  const realToday = new Date();
  const currentBaseDate = new Date(realToday);
  currentBaseDate.setDate(realToday.getDate() + weekOffset * 7);
  
  const currentDayIndex = currentBaseDate.getDay() === 0 ? 6 : currentBaseDate.getDay() - 1;
  const startOfWeek = new Date(currentBaseDate);
  startOfWeek.setDate(currentBaseDate.getDate() - currentDayIndex);

  const nextWeek = () => setWeekOffset(prev => prev + 1);
  const prevWeek = () => setWeekOffset(prev => prev - 1);
  const isCurrentWeek = weekOffset === 0;

  return (
    <PortalLayout role="parent" userName="Trần Văn Minh" pageTitle="Lịch học của con">
      <div className="space-y-6 max-w-6xl mx-auto pb-10">
        
        {/* Header & Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <SectionHeader 
            title="Lịch học của các con" 
            subtitle="Theo dõi lịch học trong tuần để sắp xếp thời gian đưa đón hợp lý"
          />
          
          <div className="flex flex-col sm:flex-row items-center gap-4 bg-card p-2 rounded-xl border border-border shadow-sm">
            {/* Filter */}
            <div className="flex items-center gap-2 px-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select 
                className="bg-transparent border-0 text-sm font-semibold text-foreground focus:ring-0 cursor-pointer outline-none"
                value={selectedChildId}
                onChange={(e) => setSelectedChildId(e.target.value)}
              >
                <option value="all">Tất cả các con</option>
                {children.map(child => (
                  <option key={child.id} value={child.id}>{child.full_name}</option>
                ))}
              </select>
            </div>
            
            <div className="hidden sm:block w-px h-6 bg-border" />

            {/* Week navigation */}
            <div className="flex items-center gap-2">
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={prevWeek}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="text-sm font-bold px-2 min-w-[80px] text-center text-primary">
                {isCurrentWeek ? "Tuần này" : `Tuần ${weekOffset > 0 ? '+' : ''}${weekOffset}`}
              </span>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={nextWeek}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>

        {/* Legend */}
        {selectedChildId === "all" && (
          <div className="flex flex-wrap gap-4 px-2">
            <span className="text-sm text-muted-foreground font-medium">Phân loại màu sắc:</span>
            {children.map(child => (
              <div key={child.id} className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full bg-gradient-to-br ${childColors[child.id]}`} />
                <span className="text-sm font-semibold">{child.full_name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Schedule Grid */}
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          {DAYS_OF_WEEK.map((day, i) => {
            const classes = scheduleByDay[day];
            
            const dateObj = new Date(startOfWeek);
            dateObj.setDate(startOfWeek.getDate() + i);
            const dateNumber = dateObj.getDate();
            const dateMonth = dateObj.getMonth() + 1;
            
            const isToday = isCurrentWeek && i === (realToday.getDay() === 0 ? 6 : realToday.getDay() - 1);
            
            return (
              <div key={day} className="flex flex-col gap-3 min-h-[500px] animate-fade-in" style={{ animationDelay: `${i * 100}ms` }}>
                <div className={`p-3 rounded-xl text-center border-b-2 transition-all duration-300 ${
                  isToday 
                    ? "bg-primary text-primary-foreground border-primary shadow-lg scale-105" 
                    : "bg-card text-muted-foreground border-border"
                }`}>
                  <p className="text-xs uppercase font-bold tracking-wider">{day}</p>
                  <p className={`text-2xl font-black mt-1 leading-none ${isToday ? "text-white" : "text-foreground"}`}>
                    {dateNumber}
                  </p>
                  <p className="text-[10px] font-medium opacity-70 mt-1">Tháng {dateMonth}</p>
                </div>

                <div className="flex flex-col gap-3 flex-1 relative mt-2">
                  {classes.length === 0 ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center opacity-30 text-muted-foreground">
                      <div className="h-px w-full bg-border absolute top-1/2 -translate-y-1/2" />
                      <span className="bg-background px-2 text-[10px] uppercase font-semibold relative z-10">Trống</span>
                    </div>
                  ) : (
                    classes.map((cls, idx) => (
                      <Card key={`${cls.id}-${idx}`} className={`overflow-hidden border border-border/50 shadow-sm transition-all hover:shadow-md hover:-translate-y-1 ${isToday ? "ring-2 ring-primary/20" : ""}`}>
                        <div className={`h-1.5 w-full bg-gradient-to-r ${childColors[cls.child.id]}`} />
                        <CardContent className="p-3">
                          
                          {/* Child Identifier */}
                          {selectedChildId === "all" && (
                            <div className="mb-2 flex items-center gap-1.5">
                              <div className={`h-5 w-5 rounded-full bg-gradient-to-br ${childColors[cls.child.id]} flex items-center justify-center text-[9px] font-bold text-white`}>
                                {cls.child.full_name.charAt(0)}
                              </div>
                              <span className="text-[10px] font-semibold text-muted-foreground truncate">{cls.child.full_name}</span>
                            </div>
                          )}

                          <div className="flex items-center gap-1.5 mb-1.5">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-[11px] font-bold text-foreground">{cls.start_time} - {cls.end_time}</span>
                          </div>
                          
                          <h4 className="font-bold text-sm text-foreground leading-tight mb-1">{cls.class_name}</h4>
                          <p className="text-[10px] text-muted-foreground mb-3 font-medium">{cls.subject}</p>
                          
                          <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/50">
                            {cls.classroom ? (
                              <Badge variant="outline" className="text-[9px] bg-muted/50 border-0 flex items-center gap-1">
                                <MapPin className="h-2.5 w-2.5" /> {cls.classroom}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-600 border-0 flex items-center gap-1 dark:bg-blue-900/30 dark:text-blue-400">
                                <Video className="h-2.5 w-2.5" /> Online
                              </Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </PortalLayout>
  );
}
