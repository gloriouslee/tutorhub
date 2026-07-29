"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  GraduationCap,
  Loader2,
  LogOut,
  Mail,
  Phone,
  School,
  ShieldCheck,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { resetAccountContextCache } from "@/hooks/useAccountContext";
import { createClient } from "@/lib/supabase/client";
import {
  isCompleteStudentProfile,
  normalizeContactPhone,
  normalizeStudentGrade,
} from "@/lib/validation";

interface OnboardingProfile {
  full_name: string;
  email: string;
  dob: string;
  school: string;
  grade: string;
  phone: string;
  profile_complete: boolean;
}

const EMPTY_PROFILE: OnboardingProfile = {
  full_name: "",
  email: "",
  dob: "",
  school: "",
  grade: "",
  phone: "",
  profile_complete: false,
};

const ERROR_MESSAGES: Record<string, string> = {
  invalid_full_name: "Vui lòng nhập họ và tên.",
  invalid_dob: "Ngày sinh chưa hợp lệ.",
  invalid_school: "Vui lòng nhập tên trường đang học.",
  invalid_grade: "Vui lòng chọn khối lớp.",
  invalid_phone: "Số điện thoại liên hệ chưa hợp lệ.",
  profile_update_failed: "Không thể lưu hồ sơ lúc này. Vui lòng thử lại.",
};

export default function StudentOnboardingPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<OnboardingProfile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    fetch("/api/account/profile", {
      cache: "no-store",
      credentials: "same-origin",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("profile_unavailable");
        return response.json() as Promise<OnboardingProfile>;
      })
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Không thể tải hồ sơ. Vui lòng đăng nhập lại hoặc thử lại.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function updateField(
    field: keyof Pick<
      OnboardingProfile,
      "full_name" | "dob" | "school" | "grade" | "phone"
    >,
    value: string,
  ) {
    setProfile((current) => ({ ...current, [field]: value }));
    setError("");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    const normalizedGrade = normalizeStudentGrade(profile.grade);
    const normalizedPhone = normalizeContactPhone(profile.phone);
    if (
      !normalizedGrade ||
      !normalizedPhone ||
      !isCompleteStudentProfile({
        ...profile,
        grade: normalizedGrade,
        phone: normalizedPhone,
      })
    ) {
      setError("Vui lòng điền đầy đủ và kiểm tra lại các thông tin bắt buộc.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: profile.full_name.trim(),
          dob: profile.dob,
          school: profile.school.trim(),
          grade: normalizedGrade,
          phone: normalizedPhone,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        profile_complete?: boolean;
      };
      if (!response.ok) {
        throw new Error(result.error ?? "profile_update_failed");
      }
      if (!result.profile_complete) {
        throw new Error("profile_incomplete");
      }

      resetAccountContextCache();
      router.replace("/student");
      router.refresh();
    } catch (submitError) {
      const code =
        submitError instanceof Error ? submitError.message : "profile_update_failed";
      setError(
        ERROR_MESSAGES[code] ??
          "Hồ sơ chưa đầy đủ. Vui lòng kiểm tra lại thông tin.",
      );
      setSubmitting(false);
    }
  }

  async function handleSignOut() {
    setSubmitting(true);
    await createClient().auth.signOut();
    resetAccountContextCache();
    router.replace("/login");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 px-4 py-8 md:py-12">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold">TutorHub</p>
              <p className="text-xs text-white/60">Thiết lập tài khoản học sinh</p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="text-white/70 hover:bg-white/10 hover:text-white"
            onClick={handleSignOut}
            disabled={submitting}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Đăng xuất
          </Button>
        </div>

        <Card className="border-white/10 shadow-2xl">
          <CardHeader className="space-y-4 border-b">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl">Hoàn tất hồ sơ để tiếp tục</CardTitle>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Đây là bước bắt buộc trong lần đầu sử dụng. Thông tin giúp giáo
                viên tư vấn lớp và lộ trình phù hợp với bạn.
              </p>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            {loading ? (
              <div className="flex min-h-64 items-center justify-center text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Đang tải hồ sơ...
              </div>
            ) : (
              <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <label htmlFor="full-name" className="text-sm font-medium">
                      Họ và tên <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="full-name"
                      value={profile.full_name}
                      onChange={(event) =>
                        updateField("full_name", event.target.value)
                      }
                      leftIcon={<User className="h-4 w-4" />}
                      autoComplete="name"
                      maxLength={120}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="email" className="text-sm font-medium">
                      Email tài khoản
                    </label>
                    <Input
                      id="email"
                      type="email"
                      value={profile.email}
                      leftIcon={<Mail className="h-4 w-4" />}
                      disabled
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="dob" className="text-sm font-medium">
                      Ngày sinh <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="dob"
                      type="date"
                      value={profile.dob}
                      onChange={(event) => updateField("dob", event.target.value)}
                      leftIcon={<CalendarDays className="h-4 w-4" />}
                      max={new Date().toISOString().slice(0, 10)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="phone" className="text-sm font-medium">
                      Số điện thoại liên hệ{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="phone"
                      type="tel"
                      value={profile.phone}
                      onChange={(event) =>
                        updateField("phone", event.target.value)
                      }
                      leftIcon={<Phone className="h-4 w-4" />}
                      autoComplete="tel"
                      placeholder="Ví dụ: 0912345678"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="school" className="text-sm font-medium">
                      Trường đang học <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="school"
                      value={profile.school}
                      onChange={(event) =>
                        updateField("school", event.target.value)
                      }
                      leftIcon={<School className="h-4 w-4" />}
                      placeholder="Tên trường của bạn"
                      maxLength={160}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="grade" className="text-sm font-medium">
                      Khối lớp <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <BookOpen className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <select
                        id="grade"
                        value={normalizeStudentGrade(profile.grade) ?? ""}
                        onChange={(event) =>
                          updateField("grade", event.target.value)
                        }
                        className="flex h-10 w-full rounded-md border border-input bg-background py-2 pl-10 pr-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        required
                      >
                        <option value="">Chọn khối lớp</option>
                        {Array.from({ length: 12 }, (_, index) => index + 1).map(
                          (grade) => (
                            <option key={grade} value={`Lớp ${grade}`}>
                              Lớp {grade}
                            </option>
                          ),
                        )}
                      </select>
                    </div>
                  </div>
                </div>

                {error && (
                  <p
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/30"
                    role="alert"
                  >
                    {error}
                  </p>
                )}

                <div className="flex flex-col-reverse items-center justify-between gap-3 border-t pt-5 sm:flex-row">
                  <p className="text-xs text-muted-foreground">
                    Các trường có dấu * là bắt buộc.
                  </p>
                  <Button
                    type="submit"
                    variant="gradient"
                    className="w-full sm:w-auto"
                    disabled={submitting}
                  >
                    {submitting && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Lưu và vào Student Portal
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
