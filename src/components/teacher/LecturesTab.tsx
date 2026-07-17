"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getClassMaterials, deleteClassMaterial, type StoredClassMaterial } from "@/lib/storage";
import { Clock, PlayCircle, Eye, Trash2, Lock, FileText } from "lucide-react";
import { formatDate } from "./classDetail.types";

export default function LecturesTab({
  classId,
  lectures,
  materials,
  addButton,
  setUploadedMaterials,
}: {
  classId: string;
  lectures: any[];
  materials: StoredClassMaterial[];
  addButton: React.ReactNode;
  setUploadedMaterials: (mats: StoredClassMaterial[]) => void;
}) {
  // Nguồn dữ liệu là prop từ page → tự cập nhật ngay khi upload xong (trước đây
  // tab tự load nên nội dung mới chỉ hiện sau khi rời/vào lại tab).
  const uploaded = materials.filter(m => m.kind === "lecture");

  const sortedMocks = [...lectures].sort((a, b) => a.order - b.order);
  const total = sortedMocks.length + uploaded.length;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{total} bài giảng</p>
        {addButton}
      </div>

      {/* Uploaded lectures (deletable) */}
      {uploaded.map((lec, i) => (
        <Card key={lec.id} className="overflow-hidden animate-fade-in transition-all hover:shadow-md" style={{ animationDelay: `${i * 60}ms` }}>
          <CardContent className="p-0">
            <div className="flex flex-col sm:flex-row">
              <div className="sm:w-44 flex items-center justify-center p-6 bg-primary/5">
                <div className="h-14 w-14 rounded-2xl flex items-center justify-center bg-primary/10 text-primary">
                  <PlayCircle className="h-7 w-7" />
                </div>
              </div>
              <div className="flex-1 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="info" className="text-[10px]">Đã tải lên</Badge>
                      <span className="text-xs text-muted-foreground">{formatDate(lec.created_at)}</span>
                    </div>
                    <h3 className="font-semibold text-foreground">{lec.title}</h3>
                    {lec.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{lec.description}</p>}
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" />{lec.file_type?.toUpperCase()}</span>
                      {lec.file_size && <span>{lec.file_size}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {lec.file_url && !lec.file_url.startsWith("/uploads/") && (
                      <a
                        href={lec.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                        title="Xem / Tải xuống"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={async () => { await deleteClassMaterial(lec.id); setUploadedMaterials(await getClassMaterials(classId)); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Mock lectures (read-only demo data) */}
      {sortedMocks.map((lec, i) => (
        <Card key={lec.id} className={`overflow-hidden animate-fade-in transition-all hover:shadow-md ${!lec.is_published ? "border-dashed" : ""}`} style={{ animationDelay: `${(uploaded.length + i) * 60}ms` }}>
          <CardContent className="p-0">
            <div className="flex flex-col sm:flex-row">
              <div className={`sm:w-44 flex items-center justify-center p-6 ${lec.is_published ? "bg-primary/5" : "bg-amber-50 dark:bg-amber-900/10"}`}>
                <div className={`h-14 w-14 rounded-2xl flex items-center justify-center ${lec.is_published ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                  {lec.is_published ? <PlayCircle className="h-7 w-7" /> : <Lock className="h-5 w-5" />}
                </div>
              </div>
              <div className="flex-1 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={lec.is_published ? "info" : "warning"} className="text-[10px]">{lec.is_published ? "Đã xuất bản" : "Bản nháp"}</Badge>
                      <span className="text-xs text-muted-foreground">Bài {lec.order}</span>
                    </div>
                    <h3 className="font-semibold text-foreground">{lec.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{lec.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{lec.duration}</span>
                      <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{lec.views} lượt xem</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
