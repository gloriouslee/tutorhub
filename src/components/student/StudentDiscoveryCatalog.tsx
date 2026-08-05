"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type {
  CatalogMaterial,
  ClassCatalogItem,
  RegistrationPackage,
} from "@/lib/class-registration-types";
import { isDiscoverableClass } from "@/lib/class-catalog";
import { formatCurrency } from "@/lib/utils";
import {
  BookOpen,
  CheckCircle2,
  Clock,
  FileText,
  GraduationCap,
  Layers,
  Map,
  Search,
  Send,
  Wifi,
  Users,
  X,
} from "lucide-react";

const MODE_LABEL: Record<string, string> = {
  online: "Trực tuyến",
  offline: "Trực tiếp",
  hybrid: "Kết hợp",
};

const PACKAGE_LABEL: Record<RegistrationPackage, string> = {
  online: "Gói Online",
  advanced: "Gói Nâng cao",
  offline: "Gói Offline",
};

function tuitionLabel(amount: number) {
  return amount > 0 ? `${formatCurrency(amount)}/buổi` : "Chưa cập nhật";
}

function requestLabel(status?: string | null) {
  if (status === "pending") return "Đang chờ giáo viên duyệt";
  if (status === "approved") return "Đã được duyệt";
  if (status === "rejected") return "Đã bị từ chối · Có thể đăng ký lại";
  return "Đăng ký lớp";
}

function RegisterButton({
  item,
  source,
  resourceId,
  packageType,
  onRegistered,
}: {
  item: ClassCatalogItem;
  source: "class" | "material";
  resourceId?: string;
  packageType: RegistrationPackage;
  onRegistered: (requestId: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const disabled =
    item.enrolled || item.registration_status === "pending" || saving;

  async function register() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/class-registration-requests", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          class_id: item.id,
          source,
          resource_id: resourceId,
          package_type: packageType,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(String(result.error ?? "request_failed"));
      onRegistered(String(result.id));
    } catch {
      setError("Chưa thể gửi yêu cầu. Vui lòng thử lại.");
      setSaving(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <Button className="w-full" disabled={disabled} onClick={register}>
        {item.enrolled ? (
          <><CheckCircle2 className="mr-2 h-4 w-4" />Đang theo học</>
        ) : item.registration_status === "pending" ? (
          <><Clock className="mr-2 h-4 w-4" />Đang chờ duyệt</>
        ) : (
          <><Send className="mr-2 h-4 w-4" />{saving ? "Đang gửi…" : requestLabel(item.registration_status)}</>
        )}
      </Button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function ClassDetailModal({
  item,
  source,
  resourceId,
  onRegistered,
  onClose,
}: {
  item: ClassCatalogItem;
  source: "class" | "material";
  resourceId?: string;
  onRegistered: (requestId: string) => void;
  onClose: () => void;
}) {
  const [packageType, setPackageType] = useState<RegistrationPackage>(
    item.registration_package ?? "online",
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div>
            <div className="mb-2 flex flex-wrap gap-2">
              <Badge>{item.subject}</Badge>
              <Badge variant="outline">{MODE_LABEL[item.learning_mode]}</Badge>
              {item.grade && <Badge variant="outline">Khối {item.grade}</Badge>}
            </div>
            <h2 className="text-xl font-bold">{item.class_name}</h2>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <GraduationCap className="h-4 w-4" /> {item.tutor_name}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-6 overflow-y-auto p-5">
          {item.description && (
            <div>
              <h3 className="mb-2 font-semibold">Giới thiệu lớp</h3>
              <p className="whitespace-pre-line text-sm text-muted-foreground">
                {item.description}
              </p>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border p-3 text-sm">
              <p className="text-xs text-muted-foreground">Sĩ số hiện tại</p>
              <p className="mt-1 flex items-center gap-2 font-semibold">
                <Users className="h-4 w-4 text-primary" />
                {item.student_count}/{item.max_students ?? "—"} học viên
              </p>
            </div>
            <div className="rounded-xl border border-border p-3 text-sm">
              <p className="text-xs text-muted-foreground">Lịch học</p>
              <p className="mt-1 font-semibold">
                {item.schedule.length
                  ? item.schedule
                      .map((slot) => `${slot.day} ${slot.start_time}–${slot.end_time}`)
                      .join(", ")
                  : "Giáo viên sẽ cập nhật"}
              </p>
            </div>
          </div>

          <div>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="font-semibold">Chọn gói đăng ký</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Học phí theo buổi, áp dụng cho kỳ {item.tuition.period}.
                </p>
              </div>
              <Badge variant="outline">Tính theo số buổi thực tế</Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {(["online", "advanced", "offline"] as const).map((option) => {
                const selected = packageType === option;
                const amount = item.tuition[option];
                return (
                  <button
                    key={option}
                    type="button"
                    disabled={
                      item.enrolled || item.registration_status === "pending"
                    }
                    onClick={() => setPackageType(option)}
                    className={`rounded-xl border p-4 text-left transition-colors ${
                      selected
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 font-semibold">
                        {option === "online" ? (
                          <Wifi className="h-4 w-4 text-sky-600" />
                        ) : option === "advanced" ? (
                          <Layers className="h-4 w-4 text-violet-600" />
                        ) : (
                          <Users className="h-4 w-4 text-amber-600" />
                        )}
                        {PACKAGE_LABEL[option]}
                      </span>
                      <span
                        className={`h-4 w-4 rounded-full border ${
                          selected
                            ? "border-[5px] border-primary"
                            : "border-muted-foreground/40"
                        }`}
                      />
                    </span>
                    <p className="mt-3 text-lg font-bold text-primary">
                      {tuitionLabel(amount)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {option === "online"
                        ? "Tham gia các buổi học trực tuyến."
                        : option === "advanced"
                          ? "Học online kèm tài liệu và hỗ trợ nâng cao."
                          : "Học trực tiếp tại lớp theo lịch của giáo viên."}
                    </p>
                  </button>
                );
              })}
            </div>
            {item.tuition[packageType] <= 0 && (
              <p className="mt-2 text-xs text-amber-600">
                Giáo viên chưa nhập đơn giá cho gói này và sẽ xác nhận học phí
                khi duyệt yêu cầu.
              </p>
            )}
          </div>

          <div>
            <h3 className="mb-3 flex items-center gap-2 font-semibold">
              <Map className="h-4 w-4 text-primary" /> Lộ trình học
            </h3>
            {item.roadmap.length === 0 ? (
              <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                Giáo viên chưa công bố lộ trình cho lớp này.
              </p>
            ) : (
              <div className="space-y-3">
                {item.roadmap.map((chapter, chapterIndex) => (
                  <div key={chapter.id || chapterIndex} className="rounded-xl border border-border p-4">
                    <p className="font-semibold">
                      {chapterIndex + 1}. {chapter.title}
                    </p>
                    <div className="mt-2 space-y-2">
                      {(chapter.sessions ?? []).map((session) => (
                        <div key={session.id} className="rounded-lg bg-muted/40 px-3 py-2">
                          <p className="text-sm font-medium">{session.title}</p>
                          {session.date && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {new Date(`${session.date}T00:00:00`).toLocaleDateString("vi-VN")}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-3 flex items-center gap-2 font-semibold">
              <FileText className="h-4 w-4 text-primary" /> Tài liệu đã công bố
            </h3>
            {item.materials.length === 0 ? (
              <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                Chưa có bộ tài liệu công khai cho lớp này.
              </p>
            ) : (
              <div className="space-y-2">
                {item.materials.map((material) => (
                  <div key={material.id} className="rounded-xl border border-border p-3">
                    <p className="text-sm font-semibold">{material.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {material.description || `${material.chapters.length} chương`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border p-4">
          <RegisterButton
            item={item}
            source={source}
            resourceId={resourceId}
            packageType={packageType}
            onRegistered={onRegistered}
          />
        </div>
      </div>
    </div>
  );
}

export default function StudentDiscoveryCatalog({
  mode,
}: {
  mode: "classes" | "materials";
}) {
  const [catalog, setCatalog] = useState<ClassCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<{
    item: ClassCatalogItem;
    material?: CatalogMaterial;
  } | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/class-catalog", {
      cache: "no-store",
      credentials: "same-origin",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("catalog_failed");
        return response.json() as Promise<ClassCatalogItem[]>;
      })
      .then((items) => {
        if (active) setCatalog(items);
      })
      .catch(() => {
        if (active) setError("Không thể tải danh mục lúc này.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const updatePending = (classId: string, requestId: string) => {
    setCatalog((items) =>
      items.map((item) =>
        item.id === classId
          ? {
              ...item,
              registration_status: "pending",
              registration_id: requestId,
            }
          : item,
      ),
    );
    setSelected((current) =>
      current?.item.id === classId
        ? {
            ...current,
            item: {
              ...current.item,
              registration_status: "pending",
              registration_id: requestId,
            },
          }
        : current,
    );
  };

  const query = search.trim().toLowerCase();
  const classItems = useMemo(
    () =>
      catalog.filter(
        (item) =>
          isDiscoverableClass(item)
          && (
            !query
            || item.class_name.toLowerCase().includes(query)
            || item.subject.toLowerCase().includes(query)
            || item.tutor_name.toLowerCase().includes(query)
          ),
      ),
    [catalog, query],
  );
  const materialItems = useMemo(
    () =>
      catalog.flatMap((item) =>
        item.materials
          .filter(
            (material) =>
              !query
              || material.title.toLowerCase().includes(query)
              || material.subject.toLowerCase().includes(query)
              || item.tutor_name.toLowerCase().includes(query),
          )
          .map((material) => ({ item, material })),
      ),
    [catalog, query],
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-lg font-bold">
            {mode === "classes" ? "Khám phá tất cả lớp học" : "Tài liệu từ các lớp khác"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "classes"
              ? "Xem lớp của mọi giáo viên, lộ trình và gửi yêu cầu đăng ký."
              : "Xem trước tài liệu đã công bố; quyền truy cập được mở sau khi giáo viên duyệt vào lớp."}
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-10 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary"
            placeholder={mode === "classes" ? "Tìm lớp, môn, giáo viên…" : "Tìm tài liệu, môn, giáo viên…"}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Đang tải danh mục…
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {mode === "classes"
            ? classItems.map((item) => (
                <Card key={item.id} className="overflow-hidden">
                  <div className="h-1.5" style={{ background: item.color ?? "#6366f1" }} />
                  <CardContent className="space-y-4 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{item.class_name}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.subject} · {item.tutor_name}
                        </p>
                      </div>
                      {item.registration_status === "pending" && (
                        <Badge variant="outline" className="text-amber-600">
                          Chờ duyệt
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {item.student_count}/{item.max_students ?? "—"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Map className="h-3.5 w-3.5" />
                        {item.roadmap.length} chương
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5" />
                        {item.materials.length} bộ tài liệu
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted/40 p-3 text-xs">
                      <div>
                        <p className="text-muted-foreground">Online</p>
                        <p className="mt-1 font-semibold text-foreground">
                          {tuitionLabel(item.tuition.online)}
                        </p>
                      </div>
                      <div className="border-l border-border pl-3">
                        <p className="text-muted-foreground">Nâng cao</p>
                        <p className="mt-1 font-semibold text-foreground">
                          {tuitionLabel(item.tuition.advanced)}
                        </p>
                      </div>
                      <div className="border-l border-border pl-3">
                        <p className="text-muted-foreground">Offline</p>
                        <p className="mt-1 font-semibold text-foreground">
                          {tuitionLabel(item.tuition.offline)}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setSelected({ item })}
                    >
                      <BookOpen className="mr-2 h-4 w-4" /> Xem chi tiết
                    </Button>
                  </CardContent>
                </Card>
              ))
            : materialItems.map(({ item, material }) => (
                <Card key={material.id}>
                  <CardContent className="space-y-4 p-5">
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{material.title}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.class_name} · {item.tutor_name}
                        </p>
                      </div>
                    </div>
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {material.description || "Bộ tài liệu theo lộ trình của lớp học."}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Layers className="h-3.5 w-3.5" />
                      {material.chapters.length} chương
                    </div>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setSelected({ item, material })}
                    >
                      Xem nội dung & đăng ký
                    </Button>
                  </CardContent>
                </Card>
              ))}
        </div>
      )}

      {!loading
        && !error
        && (mode === "classes" ? classItems.length === 0 : materialItems.length === 0)
        && (
          <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            Không tìm thấy nội dung phù hợp.
          </div>
        )}

      {selected && (
        <ClassDetailModal
          item={selected.item}
          source={selected.material ? "material" : "class"}
          resourceId={selected.material?.id}
          onRegistered={(requestId) => updatePending(selected.item.id, requestId)}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}
