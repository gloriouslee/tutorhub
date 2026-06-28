"use client";

import { useState } from "react";

import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/shared";
import { MOCK_CLASSES } from "@/lib/mock-data";
import { Calendar, Clock, MapPin, Video, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const DAYS_OF_WEEK = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"];

const mapDay = (day: string) => {
  const map: Record<string, string> = {
    "Monday": "Thứ Hai", "Tuesday": "Thứ Ba", "Wednesday": "Thứ Tư",
    "Thursday": "Thứ Năm", "Friday": "Thứ Sáu", "Saturday": "Thứ Bảy", "Sunday": "Chủ Nhật"
  };
  return map[day] || day;
};

export default function StudentSchedulePage() {
  const [weekOffset, setWeekOffset] = useState(0);

  const scheduleByDay: Record<string, any[]> = {};
  DAYS_OF_WEEK.forEach(day => { scheduleByDay[day] = []; });

  MOCK_CLASSES.forEach(cls => {
    cls.schedule.forEach(slot => {
      const vDay = mapDay(slot.day);
      if (scheduleByDay[vDay]) {
        scheduleByDay[vDay].push({ ...cls, start_time: slot.start_time, end_time: slot.end_time });
      }
    });
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
    <PortalLayout role="student" userName="Nguyễn Anh Tuấn" pageTitle="Lịch học">
      <div className="space-y-6 max-w-6xl mx-auto">
        <SectionHeader 
          title="Lịch học của tôi" 
          subtitle="Thời khóa biểu các lớp trong tuần"
          action={
            <div className="flex items-center gap-2">
              <Button size="icon" variant="outline" className="h-8 w-8" onClick={prevWeek}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="text-sm font-medium px-2 min-w-[80px] text-center">
                {isCurrentWeek ? "Tuần này" : `Tuần ${weekOffset > 0 ? '+' : ''}${weekOffset}`}
              </span>
              <Button size="icon" variant="outline" className="h-8 w-8" onClick={nextWeek}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          {DAYS_OF_WEEK.map((day, i) => {
            const classes = scheduleByDay[day];
            
            const dateObj = new Date(startOfWeek);
            dateObj.setDate(startOfWeek.getDate() + i);
            const dateNumber = dateObj.getDate();
            
            const isToday = isCurrentWeek && i === (realToday.getDay() === 0 ? 6 : realToday.getDay() - 1);
            
            return (
              <div key={day} className="flex flex-col gap-3 min-h-[500px] animate-fade-in" style={{ animationDelay: `${i * 100}ms` }}>
                <div className={`p-3 rounded-xl text-center border-b-2 ${
                  isToday 
                    ? "bg-primary text-primary-foreground border-primary shadow-md" 
                    : "bg-muted/50 text-muted-foreground border-transparent"
                }`}>
                  <p className="text-xs uppercase font-bold tracking-wider">{day}</p>
                  <p className={`text-xl font-black mt-1 ${isToday ? "text-white" : "text-foreground"}`}>{dateNumber}</p>
                </div>

                <div className="flex flex-col gap-3 flex-1 relative">
                  {classes.length === 0 ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center opacity-30 text-muted-foreground">
                      <div className="h-px w-full bg-border absolute top-1/2 -translate-y-1/2" />
                      <span className="bg-background px-2 text-[10px] uppercase font-semibold relative z-10">Trống</span>
                    </div>
                  ) : (
                    classes.map((cls, idx) => (
                      <Card key={`${cls.id}-${idx}`} className={`overflow-hidden border-0 shadow-sm transition-transform hover:-translate-y-1 ${isToday ? "ring-2 ring-primary/20" : ""}`}>
                        <div className="h-1.5 w-full" style={{ background: cls.color }} />
                        <CardContent className="p-3">
                          <div className="flex items-center gap-1.5 mb-2">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-[11px] font-bold text-foreground">{cls.start_time} - {cls.end_time}</span>
                          </div>
                          <h4 className="font-semibold text-sm text-foreground leading-tight mb-1">{cls.class_name}</h4>
                          <p className="text-[10px] text-muted-foreground mb-3">{cls.subject}</p>
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
