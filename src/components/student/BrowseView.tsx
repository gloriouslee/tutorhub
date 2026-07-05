"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getGrantedPackages, getStudentPackages, getCourseRating, getCourseReviews } from "@/lib/storage";
import { useStudentContext } from "@/hooks/useStudentContext";
import type { StudentPackage } from "@/lib/storage";
import {
  PlayCircle, FileText, CheckCircle2,
  BookOpen, Search, ShoppingCart,
  Lock, Star, Layers, Eye,
} from "lucide-react";
import {
  OWNED_COURSES, PAID_PACKAGES, PKG_META, TIER_CONFIG, fmt,
  loadTeacherCourses, teacherCourseToPaidPackage,
  type OwnedCourse, type PaidLesson, type PaidPackage, type TeacherCourse,
} from "./materialsShared";
import PreviewPlayerModal from "./PreviewPlayerModal";
import PackageModal from "./PackageModal";
import ReviewModal from "./ReviewModal";

// ─────────────────────────────────────────────────────────────────────────────
// Browse view
// ─────────────────────────────────────────────────────────────────────────────

export default function BrowseView({ onSelectCourse }: { onSelectCourse: (c: OwnedCourse, isLocked: boolean) => void }) {
  const { studentId: CURRENT_STUDENT_ID, studentName: CURRENT_STUDENT_NAME, myClasses, assignedClassId } = useStudentContext();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedPkg, setSelectedPkg] = useState<PaidPackage | null>(null);
  const [previewLesson, setPreviewLesson] = useState<{ lesson: PaidLesson; pkg: PaidPackage } | null>(null);
  const [grantedPkgIds, setGrantedPkgIds] = useState<string[]>([]);
  const [studentPkgs, setStudentPkgs] = useState<Record<string, StudentPackage | null>>({});
  const [teacherCourses, setTeacherCourses] = useState<TeacherCourse[]>([]);
  const [ratings, setRatings] = useState<Record<string, { rating: number; reviewCount: number }>>({});
  const [reviewModal, setReviewModal] = useState<{ courseId: string; courseName: string } | null>(null);

  // Filter courses to only those matching the student's enrolled classes
  const myClassIds = myClasses.map(c => c.id);
  const isEnrolled = CURRENT_STUDENT_ID.startsWith("enr_");
  const myCourses = isEnrolled
    ? OWNED_COURSES.filter(oc => oc.classId && myClassIds.includes(oc.classId))
    : OWNED_COURSES;

  const reloadRatings = (pkgIds: string[]) => {
    const map: Record<string, { rating: number; reviewCount: number }> = {};
    pkgIds.forEach(id => { map[id] = getCourseRating(id); });
    setRatings(map);
  };

  useEffect(() => {
    const granted = getGrantedPackages();
    setGrantedPkgIds(granted);
    const tc = loadTeacherCourses();
    setTeacherCourses(tc);
    const map: Record<string, StudentPackage | null> = {};
    OWNED_COURSES.forEach(oc => {
      const pkgs = getStudentPackages(oc.classId);
      const pkg = pkgs[CURRENT_STUDENT_ID] ?? (isEnrolled && oc.classId === assignedClassId ? "online" : null);
      map[oc.id] = pkg;
    });
    setStudentPkgs(map);
    // Load computed ratings for all paid packages (mock + teacher)
    const allIds = [...PAID_PACKAGES.map(p => p.id), ...tc.filter(t => t.type === "paid_package").map(t => t.id)];
    reloadRatings(allIds);
  }, [CURRENT_STUDENT_ID, assignedClassId]);

  // Teacher-created paid packages from localStorage (published only)
  const teacherPaidPackages = teacherCourses
    .filter(tc => tc.type === "paid_package" && tc.published && tc.title)
    .map(teacherCourseToPaidPackage);

  // Merge: teacher packages override PAID_PACKAGES with same id, then append rest
  const teacherIds = new Set(teacherPaidPackages.map(p => p.id));
  const allPaidPackages = [
    ...teacherPaidPackages,
    ...PAID_PACKAGES.filter(p => !teacherIds.has(p.id)),
  ];

  const filteredPkg = search.trim()
    ? allPaidPackages.filter(p =>
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.subject.toLowerCase().includes(search.toLowerCase())
      )
    : allPaidPackages;

  return (
    <div className="space-y-10">

      {/* ── Tài liệu của tôi ── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Tài liệu của tôi</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Tài liệu từ các lớp học bạn đang theo học</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {myCourses.length === 0 ? (
            <div className="col-span-full py-10 text-center text-sm text-muted-foreground border-2 border-dashed border-border/50 rounded-2xl">
              Chưa có tài liệu nào. Tài liệu sẽ hiển thị sau khi bạn được phân lớp học.
            </div>
          ) : myCourses.map(course => {
            const allLessons = course.chapters.flatMap(ch => ch.lessons);
            const done = allLessons.filter(l => l.status === "done").length;
            const pct = Math.round((done / allLessons.length) * 100);
            const videoCount = allLessons.filter(l => l.type === "video").length;
            const pdfCount = allLessons.filter(l => l.type === "pdf").length;
            const myPkg = studentPkgs[course.id];
            const tc = teacherCourses.find(t => t.classId === course.classId);
            const isPackageLocked = !!(myPkg && tc && tc.packages.length > 0 && !tc.packages.includes(myPkg));

            return (
              <Card
                key={course.id}
                className={`group cursor-pointer hover:shadow-lg hover:border-primary/40 transition-all overflow-hidden ${isPackageLocked ? "opacity-80" : ""}`}
                onClick={() => onSelectCourse(course, isPackageLocked)}
              >
                <div className="h-1.5 w-full" style={{ background: course.color }} />
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: course.color + "22" }}>
                      {isPackageLocked
                        ? <Lock className="h-5 w-5 text-muted-foreground" />
                        : <BookOpen className="h-5 w-5" style={{ color: course.color }} />}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge className="text-[10px] shrink-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">
                        Đã sở hữu
                      </Badge>
                      {myPkg && (() => {
                        const meta = PKG_META[myPkg];
                        const Icon = meta.icon;
                        return (
                          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${meta.color}`}>
                            <Icon className="h-2.5 w-2.5" />{meta.label}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  {isPackageLocked && (
                    <div className="mb-3 px-2.5 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                      <Lock className="h-3 w-3 shrink-0" />
                      Gói {myPkg && PKG_META[myPkg].label} chưa có quyền xem tài liệu này
                    </div>
                  )}
                  <h3 className="font-semibold text-sm text-foreground leading-snug mb-1 group-hover:text-primary transition-colors">
                    {course.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mb-4">{course.subject}</p>
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Tiến độ</span>
                      <span className="font-medium text-primary">{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground">{done}/{allLessons.length} bài hoàn thành</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground border-t border-border pt-3">
                    <span className="flex items-center gap-1"><PlayCircle className="h-3 w-3" />{videoCount} video</span>
                    <span className="flex items-center gap-1"><FileText className="h-3 w-3" />{pdfCount} PDF</span>
                    <span className="flex items-center gap-1"><Layers className="h-3 w-3" />{course.chapters.length} chương</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* ── Gói tài liệu trả phí ── */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Mua thêm tài liệu</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Các gói tài liệu nâng cao, bộ đề luyện thi THPT · Có bài xem thử miễn phí</p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Tìm môn học, gói tài liệu..." className="pl-9 h-9"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {filteredPkg.map(pkg => {
            const tier = TIER_CONFIG[pkg.tier];
            const TierIcon = tier.icon;
            const discount = pkg.originalPrice
              ? Math.round((1 - pkg.price / pkg.originalPrice) * 100) : null;
            const totalLessons = pkg.chapters.flatMap(c => c.lessons).length;
            const previewCount = pkg.chapters.flatMap(c => c.lessons).filter(l => l.isPreview).length;

            return (
              <Card
                key={pkg.id}
                className={`group flex flex-col ring-1 ${tier.ring} hover:ring-primary/40 hover:shadow-lg transition-all`}
              >
                <CardContent className="p-5 flex flex-col h-full">
                  <div className="flex items-center justify-between mb-4">
                    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${tier.color}`}>
                      <TierIcon className="h-3 w-3" />{tier.label}
                    </span>
                    {discount && (
                      <span className="text-[10px] font-bold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded-full">
                        -{discount}%
                      </span>
                    )}
                  </div>

                  <Badge variant="outline" className="w-fit text-xs mb-2">{pkg.subject} · Khối {pkg.grade}</Badge>

                  <h3
                    className="font-semibold text-sm text-foreground leading-snug mb-2 group-hover:text-primary transition-colors cursor-pointer flex-1"
                    onClick={() => setSelectedPkg(pkg)}
                  >
                    {pkg.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{pkg.description}</p>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                    <span className="flex items-center gap-1"><PlayCircle className="h-3 w-3" />{totalLessons} bài</span>
                    {previewCount > 0 && (
                      <span className="flex items-center gap-1 text-violet-600 dark:text-violet-400">
                        <Eye className="h-3 w-3" />{previewCount} xem thử
                      </span>
                    )}
                  </div>

                  {(() => {
                    const computed = ratings[pkg.id];
                    const r = computed?.reviewCount ? computed.rating : pkg.rating;
                    const n = computed?.reviewCount ?? pkg.reviewCount;
                    if (!r && !n) return null;
                    return (
                      <div className="flex items-center gap-1.5 mb-4">
                        <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                        <span className="text-xs font-semibold">{r > 0 ? r.toFixed(1) : "—"}</span>
                        <span className="text-xs text-muted-foreground">({n} đánh giá)</span>
                      </div>
                    );
                  })()}

                  <div className="border-t border-border pt-3 mt-auto space-y-2">
                    {grantedPkgIds.includes(pkg.id) ? (
                      <>
                        <div className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-sm font-medium">
                          <CheckCircle2 className="h-4 w-4" /> Đã sở hữu
                        </div>
                        <button
                          onClick={() => setReviewModal({ courseId: pkg.id, courseName: pkg.title })}
                          className="w-full text-xs text-amber-600 dark:text-amber-400 hover:underline flex items-center justify-center gap-1 py-1"
                        >
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          {getCourseReviews(pkg.id).find(r => r.student_id === CURRENT_STUDENT_ID)
                            ? "Cập nhật đánh giá của bạn"
                            : "Đánh giá khóa học"}
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-base font-bold text-foreground">{fmt(pkg.price)}</p>
                            {pkg.originalPrice && (
                              <p className="text-xs text-muted-foreground line-through">{fmt(pkg.originalPrice)}</p>
                            )}
                          </div>
                          <Button size="sm" className="h-8 gap-1.5 text-xs"
                            onClick={() => router.push(`/student/payments?pkg=${pkg.id}`)}>
                            <ShoppingCart className="h-3.5 w-3.5" /> Mua
                          </Button>
                        </div>
                        {previewCount > 0 && (
                          <button
                            onClick={() => setSelectedPkg(pkg)}
                            className="w-full text-xs text-violet-600 dark:text-violet-400 hover:underline flex items-center justify-center gap-1"
                          >
                            <Eye className="h-3 w-3" /> Xem thử {previewCount} bài miễn phí
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {filteredPkg.length === 0 && (
            <div className="col-span-full py-10 text-center text-sm text-muted-foreground border-2 border-dashed border-border rounded-xl">
              Không tìm thấy gói tài liệu phù hợp
            </div>
          )}
        </div>
      </section>

      {/* Modals */}
      {selectedPkg && !previewLesson && (
        <PackageModal
          pkg={selectedPkg}
          onClose={() => setSelectedPkg(null)}
          onPreview={lesson => setPreviewLesson({ lesson, pkg: selectedPkg })}
          onBuy={() => { setSelectedPkg(null); router.push(`/student/payments?pkg=${selectedPkg.id}`); }}
        />
      )}
      {previewLesson && (
        <PreviewPlayerModal
          lesson={previewLesson.lesson}
          packageTitle={previewLesson.pkg.title}
          onClose={() => setPreviewLesson(null)}
          onBuy={() => { setPreviewLesson(null); setSelectedPkg(previewLesson.pkg); }}
        />
      )}
      {reviewModal && (
        <ReviewModal
          courseId={reviewModal.courseId}
          courseName={reviewModal.courseName}
          studentId={CURRENT_STUDENT_ID}
          studentName={CURRENT_STUDENT_NAME}
          existingReview={getCourseReviews(reviewModal.courseId).find(r => r.student_id === CURRENT_STUDENT_ID)}
          onSave={() => {
            const allIds = [...PAID_PACKAGES.map(p => p.id), ...teacherCourses.filter(t => t.type === "paid_package").map(t => t.id)];
            reloadRatings(allIds);
          }}
          onClose={() => setReviewModal(null)}
        />
      )}
    </div>
  );
}
