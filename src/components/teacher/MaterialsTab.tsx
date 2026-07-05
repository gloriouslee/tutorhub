"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  deleteClassMaterial, getClassMaterials,
  type StoredClassMaterial, type StudentPackage,
} from "@/lib/storage";
import { FileText, Download, PlayCircle, Eye, Trash2, Image } from "lucide-react";
import { CATEGORY_MAP } from "./classDetail.types";

function getFileIcon(type: string) {
  if (type === "video") return <PlayCircle className="h-5 w-5" />;
  if (type === "image") return <Image className="h-5 w-5" />;
  return <FileText className="h-5 w-5" />;
}

export default function MaterialsTab({
  classId,
  materials,
  addButton,
  setUploadedMaterials,
}: {
  classId: string;
  materials: any[];
  addButton: React.ReactNode;
  setUploadedMaterials: (mats: StoredClassMaterial[]) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{materials.length} tài liệu</p>
        {addButton}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {materials.map((mat, i) => {
          const cat = CATEGORY_MAP[mat.category] || { label: mat.category, color: "bg-muted text-muted-foreground" };
          return (
            <Card key={mat.id} className="group hover:shadow-lg hover:border-primary/30 transition-all animate-fade-in flex flex-col" style={{ animationDelay: `${i * 60}ms` }}>
              <CardContent className="p-5 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-3">
                  <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${mat.file_type === "pdf" ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" : "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"}`}>
                    {getFileIcon(mat.file_type)}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${cat.color}`}>{cat.label}</span>
                    {mat.id.startsWith("mat_") && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => {
                          deleteClassMaterial(mat.id);
                          setUploadedMaterials(getClassMaterials(classId));
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                <h3 className="font-semibold text-sm text-foreground line-clamp-2 mb-1">{mat.title}</h3>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{mat.description}</p>
                {"packages" in mat && mat.packages && mat.packages.length > 0 && (
                  <div className="flex gap-1 flex-wrap mb-2">
                    {(mat.packages as StudentPackage[]).map(pkg => (
                      <span key={pkg} className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                        pkg === "online" ? "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400"
                        : pkg === "advanced" ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
                        : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                      }`}>
                        {pkg === "online" ? "Online" : pkg === "advanced" ? "Nâng cao" : "Offline"}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-auto mb-3">
                  <span>{mat.file_size}</span><span>·</span>
                  <span className="flex items-center gap-1"><Download className="h-3 w-3" />{mat.download_count}</span>
                </div>
                <div className="pt-3 border-t border-border/50">
                  {mat.file_url && !mat.file_url.startsWith("/uploads/") ? (
                    <a
                      href={mat.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 w-full h-8 text-xs rounded-lg border border-border bg-background hover:bg-muted transition-colors font-medium text-foreground"
                    >
                      <Eye className="h-3 w-3" />Xem / Tải xuống
                    </a>
                  ) : (
                    <Button size="sm" variant="outline" className="w-full text-xs h-8"><Eye className="h-3 w-3 mr-1.5" />Xem trước</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
