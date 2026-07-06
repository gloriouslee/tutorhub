"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getClassMaterials, deleteClassMaterial } from "@/lib/storage";
import { StickyNote, Pin, Tag, Trash2 } from "lucide-react";
import { formatDate } from "./classDetail.types";

interface NoteItem {
  id: string;
  title: string;
  content?: string;
  is_pinned: boolean;
  created_at: string;
  tags?: string[];
  isUploaded: boolean;
}

export default function NotesTab({
  notes,
  addButton,
}: {
  notes: any[];
  addButton: React.ReactNode;
}) {
  const params = useParams();
  const classId = params?.classId as string;
  const [uploaded, setUploaded] = useState<NoteItem[]>([]);

  const reload = useCallback(async () => {
    if (!classId) return;
    const mats = await getClassMaterials(classId);
    setUploaded(mats.filter(m => m.kind === "note").map(m => ({
      id: m.id,
      title: m.title,
      content: m.description,
      is_pinned: !!m.pinned,
      created_at: m.created_at,
      isUploaded: true,
    })));
  }, [classId]);

  useEffect(() => { reload(); }, [reload]);

  const merged: NoteItem[] = [
    ...uploaded,
    ...notes.map(n => ({ ...n, is_pinned: !!n.is_pinned, isUploaded: false }) as NoteItem),
  ].sort((a, b) =>
    (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0) ||
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{merged.length} ghi chú</p>
        {addButton}
      </div>
      {merged.map((note, i) => (
        <Card key={note.id} className={`animate-fade-in transition-all hover:shadow-md ${note.is_pinned ? "border-amber-200 dark:border-amber-800/50 bg-amber-50/30 dark:bg-amber-900/5" : ""}`} style={{ animationDelay: `${i * 60}ms` }}>
          <CardContent className="p-5 md:p-6">
            <div className="flex items-start gap-4">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${note.is_pinned ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" : "bg-primary/10 text-primary"}`}>
                {note.is_pinned ? <Pin className="h-4 w-4" /> : <StickyNote className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {note.is_pinned && <Badge variant="warning" className="text-[10px]">Đã ghim</Badge>}
                  <span className="text-xs text-muted-foreground">{formatDate(note.created_at)}</span>
                </div>
                <h3 className="font-semibold text-foreground">{note.title}</h3>
                <p className="text-sm text-muted-foreground mt-2 whitespace-pre-line leading-relaxed">{note.content}</p>
                {note.tags && note.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {note.tags.map((tag: string) => (
                      <span key={tag} className="inline-flex items-center gap-1 text-[10px] font-medium bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                        <Tag className="h-2.5 w-2.5" />{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {note.isUploaded && (
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-red-500 hover:bg-red-50"
                    onClick={async () => { await deleteClassMaterial(note.id); await reload(); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
