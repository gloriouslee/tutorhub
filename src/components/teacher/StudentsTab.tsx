"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ProgressBar } from "@/components/shared";
import { type StudentPackage } from "@/lib/storage";
import type { ClassRegistrationRequest } from "@/lib/class-registration-types";
import { formatCurrency } from "@/lib/utils";
import { Users, Trash2, MessageSquare, Clock, CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import { PACKAGE_TYPES } from "./classDetail.types";

export default function StudentsTab({
  classStudents,
  studentSearch,
  setStudentSearch,
  comments,
  classId,
  teacherClasses,
  onRosterChanged,
  onRegistrationApproved,
  onSetPackage,
  onOpenComment,
  onRemoveStudent,
}: {
  classStudents: any[];
  studentSearch: string;
  setStudentSearch: (v: string) => void;
  comments: Record<string, { text: string; date: string; rating: number }[]>;
  classId: string;
  teacherClasses: { id: string; class_name: string; subject: string }[];
  onRosterChanged: (studentIds: string[]) => void;
  onRegistrationApproved: (
    studentId: string,
    pkg: StudentPackage,
  ) => void;
  onSetPackage: (studentId: string, pkg: StudentPackage) => void;
  onOpenComment: (student: any) => void;
  onRemoveStudent: (student: any) => void;
}) {
  const [requests, setRequests] = useState<ClassRegistrationRequest[]>([]);
  const [destinations, setDestinations] = useState<Record<string, string>>({});
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [reviewingId, setReviewingId] = useState("");
  const [requestError, setRequestError] = useState("");

  useEffect(() => {
    let active = true;
    fetch(
      `/api/class-registration-requests?class_id=${encodeURIComponent(classId)}&status=pending`,
      { cache: "no-store", credentials: "same-origin" },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("request_failed");
        return response.json() as Promise<ClassRegistrationRequest[]>;
      })
      .then((items) => {
        if (!active) return;
        setRequests(items);
        setDestinations(
          Object.fromEntries(items.map((item) => [item.id, classId])),
        );
      })
      .catch(() => {
        if (active) setRequestError("Không thể tải yêu cầu đăng ký.");
      })
      .finally(() => {
        if (active) setLoadingRequests(false);
      });
    return () => {
      active = false;
    };
  }, [classId]);

  async function review(
    request: ClassRegistrationRequest,
    action: "approve" | "reject",
  ) {
    setReviewingId(request.id);
    setRequestError("");
    try {
      const response = await fetch(
        `/api/class-registration-requests/${encodeURIComponent(request.id)}`,
        {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            assigned_class_id:
              action === "approve" ? destinations[request.id] ?? classId : null,
          }),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(String(result.error ?? "review_failed"));
      }
      setRequests((items) => items.filter((item) => item.id !== request.id));
      const roster = result.result?.student_ids;
      if (
        action === "approve"
        && destinations[request.id] === classId
        && Array.isArray(roster)
      ) {
        onRosterChanged(roster.map(String));
        onRegistrationApproved(
          request.student_id,
          request.requested_package ?? "online",
        );
      }
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      setRequestError(
        code === "class_full"
          ? "Lớp được chọn đã đủ sĩ số."
          : "Không thể xử lý yêu cầu. Vui lòng thử lại.",
      );
    } finally {
      setReviewingId("");
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/10">
        <CardContent className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 font-bold">
                <Clock className="h-4 w-4 text-amber-600" />
                Yêu cầu đăng ký lớp
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Duyệt vào lớp này hoặc phân bổ học viên sang một lớp khác bạn phụ trách.
              </p>
            </div>
            {requests.length > 0 && (
              <Badge className="bg-amber-100 text-amber-700">
                {requests.length} chờ duyệt
              </Badge>
            )}
          </div>

          {loadingRequests ? (
            <p className="py-4 text-sm text-muted-foreground">Đang tải yêu cầu…</p>
          ) : requests.length === 0 ? (
            <p className="rounded-xl border border-dashed border-amber-200 bg-background/60 p-4 text-sm text-muted-foreground">
              Hiện không có yêu cầu đăng ký đang chờ.
            </p>
          ) : (
            <div className="space-y-3">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="rounded-xl border border-border bg-background p-4"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{request.student?.full_name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {[request.student?.email, request.student?.school, request.student?.grade]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Đăng ký từ {request.source === "material" ? "tài liệu lớp học" : "danh mục lớp"}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-primary">
                          Gói{" "}
                          {request.requested_package === "advanced"
                            ? "Nâng cao"
                            : request.requested_package === "offline"
                              ? "Offline"
                              : "Online"}
                        </Badge>
                        <span className="text-xs font-semibold text-foreground">
                          {request.requested_unit_price != null
                            && request.requested_unit_price > 0
                            ? `${formatCurrency(request.requested_unit_price)}/buổi`
                            : "Học phí chưa cập nhật"}
                        </span>
                        {request.tuition_period && (
                          <span className="text-[11px] text-muted-foreground">
                            Kỳ giá {request.tuition_period}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <select
                        value={destinations[request.id] ?? classId}
                        onChange={(event) =>
                          setDestinations((current) => ({
                            ...current,
                            [request.id]: event.target.value,
                          }))
                        }
                        className="h-9 min-w-52 rounded-lg border border-input bg-background px-3 text-sm"
                      >
                        {teacherClasses.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.class_name} · {item.subject}
                          </option>
                        ))}
                      </select>
                      {destinations[request.id] !== classId && (
                        <ArrowRight className="hidden h-4 w-4 text-muted-foreground sm:block" />
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600"
                        disabled={reviewingId === request.id}
                        onClick={() => review(request, "reject")}
                      >
                        <XCircle className="mr-1.5 h-4 w-4" /> Từ chối
                      </Button>
                      <Button
                        size="sm"
                        disabled={reviewingId === request.id}
                        onClick={() => review(request, "approve")}
                      >
                        <CheckCircle2 className="mr-1.5 h-4 w-4" />
                        {reviewingId === request.id ? "Đang xử lý…" : "Duyệt"}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {requestError && (
            <p className="mt-3 text-sm text-red-600">{requestError}</p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-bold text-foreground">Danh sách học viên</h3>
          <p className="text-sm text-muted-foreground">Quản lý và theo dõi tiến độ của {classStudents.length} học viên</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Input
              placeholder="Tìm tên học viên..."
              className="pl-9"
              value={studentSearch}
              onChange={e => setStudentSearch(e.target.value)}
            />
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(PACKAGE_TYPES).map(([key, info]) => (
          <Card key={key} className="bg-card/50">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`h-2 w-2 rounded-full ${info.color.split(" ")[1]}`} />
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">{info.label}</p>
                  <p className="text-sm font-semibold">{classStudents.filter(s => s.package === key).length} học viên</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="rounded-2xl border border-border overflow-hidden bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Học viên</th>
                <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Gói đăng ký</th>
                <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-center">Tiến độ</th>
                <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {classStudents.filter(s => !studentSearch || s.full_name.toLowerCase().includes(studentSearch.toLowerCase())).map(student => (
                <tr key={student.id} className="hover:bg-muted/30 transition-colors group">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {student.full_name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-foreground">{student.full_name}</p>
                          {comments[student.id]?.length > 0 && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 border-emerald-200">
                              {comments[student.id].length} nhận xét
                            </Badge>
                          )}
                        </div>
                        {(student.school || student.grade) && (
                          <p className="text-[11px] text-muted-foreground">
                            {[student.school, student.grade].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex gap-1 flex-wrap">
                        {(["online", "advanced", "offline"] as StudentPackage[]).map(pkg => (
                          <button
                            key={pkg}
                            onClick={() => onSetPackage(student.id, pkg)}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all ${student.package === pkg ? `${PACKAGE_TYPES[pkg].color} border-transparent` : "border-border text-muted-foreground hover:border-primary/40"}`}
                          >
                            {PACKAGE_TYPES[pkg].label}
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground italic">{PACKAGE_TYPES[student.package]?.description ?? "—"}</p>
                    </div>
                  </td>
                  <td className="p-4 min-w-[150px]">
                    {student.progress == null ? (
                      <p className="text-center text-xs text-muted-foreground">—</p>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px] font-medium">
                          <span className="text-muted-foreground">Hoàn thành</span>
                          <span className="text-primary">{student.progress}%</span>
                        </div>
                        <ProgressBar value={student.progress} className="h-1.5" />
                      </div>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="sm" variant="outline" onClick={() => onOpenComment(student)}
                        className="text-xs h-8 flex items-center gap-1 hover:bg-primary/5 hover:text-primary transition-all font-semibold">
                        <MessageSquare className="h-3.5 w-3.5" /> Nhận xét
                      </Button>
                      <Button size="icon" variant="ghost" title="Xóa khỏi lớp" onClick={() => onRemoveStudent(student)}
                        className="h-8 w-8 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
