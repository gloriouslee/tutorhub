"use client";

import { useState, useEffect, useCallback } from "react";
import PortalLayout from "@/components/layout/PortalLayout";
import { SectionHeader } from "@/components/shared";
import MaterialsUploadForm from "@/components/shared/MaterialsUploadForm";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MOCK_CLASSES, MOCK_CLASS_MATERIALS } from "@/lib/mock-data";
import { FileText, PlayCircle, Image as ImageIcon, BookMarked, Trash2, RefreshCw } from "lucide-react";

function FileIcon({ type }: { type: string }) {
  if (type === "video") return <PlayCircle className="h-4 w-4" />;
  if (type === "image") return <ImageIcon className="h-4 w-4" />;
  if (type === "ppt") return <BookMarked className="h-4 w-4" />;
  return <FileText className="h-4 w-4" />;
}

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    pdf: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    video: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    image: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    ppt: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    doc: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded font-medium border-0 ${map[type] ?? map.doc}`}>
      {type.toUpperCase()}
    </span>
  );
}

const UPLOADED_KEY = "tutorhub_admin_materials";
const DELETED_KEY = "tutorhub_admin_materials_deleted";

function readJSON<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? "") as T; } catch { return fallback; }
}

export default function AdminMaterialsPage() {
  const [materials, setMaterials] = useState<any[]>([]);
  const [filterClass, setFilterClass] = useState("all");

  const loadMaterials = useCallback(() => {
    const uploaded = readJSON<any[]>(UPLOADED_KEY, []);
    const deleted = new Set(readJSON<string[]>(DELETED_KEY, []));
    setMaterials([...uploaded, ...MOCK_CLASS_MATERIALS].filter(m => !deleted.has(m.id)));
  }, []);

  useEffect(() => { loadMaterials(); }, [loadMaterials]);

  const filtered = filterClass === "all"
    ? materials
    : materials.filter(m => m.class_id === filterClass);

  const getClassName = (classId: string) =>
    classId === "all" ? "Tất cả lớp" : (MOCK_CLASSES.find(c => c.id === classId)?.class_name ?? classId);

  const handleDelete = (id: string) => {
    const deleted = readJSON<string[]>(DELETED_KEY, []);
    localStorage.setItem(DELETED_KEY, JSON.stringify([...deleted, id]));
    const uploaded = readJSON<any[]>(UPLOADED_KEY, []);
    localStorage.setItem(UPLOADED_KEY, JSON.stringify(uploaded.filter(m => m.id !== id)));
    setMaterials(prev => prev.filter(m => m.id !== id));
  };

  return (
    <PortalLayout role="admin" userName="Admin User" pageTitle="Quản lý tài liệu">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Upload section */}
        <div className="space-y-4">
          <SectionHeader
            title="Tải lên tài liệu"
            subtitle="Upload tài liệu vào bất kỳ lớp học nào trong hệ thống"
          />
          <MaterialsUploadForm
            classes={MOCK_CLASSES}
            onSaved={loadMaterials}
          />
        </div>

        {/* Library section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">Kho tài liệu</h2>
              <p className="text-sm text-muted-foreground">{filtered.length} tài liệu</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                value={filterClass}
                onChange={e => setFilterClass(e.target.value)}
              >
                <option value="all">Tất cả lớp</option>
                {MOCK_CLASSES.map(c => (
                  <option key={c.id} value={c.id}>{c.class_name}</option>
                ))}
              </select>
              <Button size="sm" variant="outline" className="h-9 gap-1.5" onClick={loadMaterials}>
                <RefreshCw className="h-3.5 w-3.5" /> Làm mới
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              {filtered.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Không có tài liệu nào
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filtered.map(mat => (
                    <div key={mat.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                      <div className="text-muted-foreground shrink-0">
                        <FileIcon type={mat.file_type} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{mat.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{mat.description}</p>
                      </div>
                      <div className="hidden sm:flex items-center gap-3 shrink-0">
                        <TypeBadge type={mat.file_type} />
                        <span className="text-xs text-muted-foreground">{getClassName(mat.class_id)}</span>
                        <span className="text-xs text-muted-foreground">{mat.file_size}</span>
                      </div>
                      <button
                        onClick={() => handleDelete(mat.id)}
                        className="text-muted-foreground hover:text-red-500 transition-colors shrink-0"
                        title="Xoá tài liệu"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </PortalLayout>
  );
}
