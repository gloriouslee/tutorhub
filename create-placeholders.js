const fs = require('fs');
const path = require('path');

const missingRoutes = [
  { path: 'student/schedule', role: 'student', title: 'Lịch học' },
  { path: 'student/materials', role: 'student', title: 'Tài liệu' },
  { path: 'student/notifications', role: 'student', title: 'Thông báo' },
  { path: 'student/profile', role: 'student', title: 'Hồ sơ' },
  { path: 'parent/children', role: 'parent', title: 'Con của tôi' },
  { path: 'parent/schedule', role: 'parent', title: 'Lịch học' },
  { path: 'parent/attendance', role: 'parent', title: 'Chuyên cần' },
  { path: 'parent/payments', role: 'parent', title: 'Thanh toán' },
  { path: 'parent/progress', role: 'parent', title: 'Tiến độ' },
  { path: 'parent/messages', role: 'parent', title: 'Tin nhắn' },
  { path: 'parent/notifications', role: 'parent', title: 'Thông báo' },
  { path: 'teacher/classes', role: 'teacher', title: 'Lớp của tôi' },
  { path: 'teacher/homework', role: 'teacher', title: 'Bài tập' },
  { path: 'teacher/submissions', role: 'teacher', title: 'Bài nộp' },
  { path: 'teacher/students', role: 'teacher', title: 'Học viên' },
  { path: 'teacher/announcements', role: 'teacher', title: 'Tin tức' },
  { path: 'teacher/notifications', role: 'teacher', title: 'Thông báo' },
  { path: 'admin/teachers', role: 'admin', title: 'Giáo viên' },
  { path: 'admin/classes', role: 'admin', title: 'Lớp học' },
  { path: 'admin/attendance', role: 'admin', title: 'Chuyên cần' },
  { path: 'admin/reports', role: 'admin', title: 'Báo cáo' },
  { path: 'admin/notifications', role: 'admin', title: 'Thông báo' },
  { path: 'admin/settings', role: 'admin', title: 'Cài đặt' }
];

const userNameMap = {
  student: 'Alex Thompson',
  parent: 'Robert Thompson',
  teacher: 'Sarah Jenkins',
  admin: 'Admin User'
};

const getTemplate = (route) => `"use client";

import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Hammer } from "lucide-react";

export default function PlaceholderPage() {
  return (
    <PortalLayout role="${route.role}" userName="${userNameMap[route.role]}" pageTitle="${route.title}">
      <Card className="border-dashed border-2 bg-muted/30 h-[400px] flex items-center justify-center">
        <CardContent className="flex flex-col items-center text-center">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Hammer className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Tính năng đang phát triển</h2>
          <p className="text-muted-foreground mt-2 max-w-[300px]">
            Trang <strong>${route.title}</strong> hiện đang được xây dựng. Vui lòng quay lại sau!
          </p>
        </CardContent>
      </Card>
    </PortalLayout>
  );
}
`;

missingRoutes.forEach(route => {
  const dirPath = path.join(__dirname, 'src/app', route.path);
  const filePath = path.join(dirPath, 'page.tsx');
  
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, getTemplate(route));
    console.log(`Created ${filePath}`);
  } else {
    console.log(`Exists ${filePath}`);
  }
});
