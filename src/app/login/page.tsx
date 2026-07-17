"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GraduationCap, Mail, Lock, Eye, EyeOff, ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { getEnrollments } from "@/lib/storage";

const DEMO_USERS = [
  { role: "student", email: "student@tutorhub.com", label: "Học viên", color: "from-indigo-500 to-purple-600", icon: "🎓" },
  { role: "parent", email: "parent@tutorhub.com", label: "Phụ huynh", color: "from-teal-500 to-emerald-600", icon: "👨‍👩‍👧" },
  { role: "teacher", email: "teacher@tutorhub.com", label: "Giáo viên", color: "from-amber-500 to-orange-600", icon: "👨‍🏫" },
  { role: "admin", email: "admin@tutorhub.com", label: "Quản trị viên", color: "from-rose-500 to-pink-600", icon: "⚙️" },
];

const HIGHLIGHTS = [
  "Lộ trình học cá nhân hoá theo từng học viên",
  "Học Online, Offline hoặc Hybrid linh hoạt",
  "Theo dõi điểm danh, bài tập, điểm thi realtime",
  "Trung tâm liên hệ xếp lớp trong 1–2 ngày",
];

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  const handleDemo = (demoEmail: string, role: string) => {
    setEmail(demoEmail);
    setPassword("demo1234");
    setLoginError("");
    setLoginLoading(true);
    document.cookie = `demo_role=${role}; path=/; max-age=86400`;
    setTimeout(() => {
      setLoginLoading(false);
      router.push(`/${role}`);
    }, 800);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);

    // 1. Demo accounts
    const demoUser = DEMO_USERS.find(d => d.email === email);
    if (demoUser && password === "demo1234") {
      document.cookie = `demo_role=${demoUser.role}; path=/; max-age=86400`;
      setTimeout(() => { setLoginLoading(false); router.push(`/${demoUser.role}`); }, 600);
      return;
    }

    // 2. Real Supabase auth (tài khoản học viên được duyệt / admin / teacher)
    const KNOWN_ROLES = ["student", "parent", "teacher", "admin"];
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error && data.user) {
        ["demo_role", "enrolled_student_id", "enrolled_student_name", "enrolled_student_class"]
          .forEach(c => { document.cookie = `${c}=; path=/; max-age=0`; });
        const metaRole = data.user.user_metadata?.role as string | undefined;
        let role = metaRole;
        if (!role) {
          const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
          role = profile?.role;
        }
        router.push(KNOWN_ROLES.includes(role ?? "") ? `/${role}` : "/student");
        return;
      }
    } catch { /* tiếp tục thử fallback */ }

    // 3. Fallback: tài khoản enrollment cũ (được duyệt trước khi có Supabase Auth)
    const enrollments = await getEnrollments();
    const matched = enrollments.find(
      enr => enr.status === "approved" &&
        enr.account_username?.toLowerCase() === email.toLowerCase() &&
        enr.account_password === password
    );
    if (matched) {
      document.cookie = `demo_role=student; path=/; max-age=86400`;
      document.cookie = `enrolled_student_id=enr_${matched.id}; path=/; max-age=86400`;
      document.cookie = `enrolled_student_name=${encodeURIComponent(matched.full_name)}; path=/; max-age=86400`;
      document.cookie = `enrolled_student_class=${encodeURIComponent(matched.assigned_class_id ?? "")}; path=/; max-age=86400`;
      setTimeout(() => { setLoginLoading(false); router.push("/student"); }, 600);
      return;
    }

    setLoginError("Email hoặc mật khẩu không đúng.");
    setLoginLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row relative overflow-hidden bg-background">

      {/* LEFT PANEL — Marketing / CTA đăng ký học */}
      <div className="w-full lg:w-[55%] relative overflow-hidden bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-300" />

        <div className="relative z-10 p-8 lg:p-14 min-h-full flex flex-col">
          <div className="flex items-center gap-3 mb-12">
            <div className="h-10 w-10 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <span className="text-white font-bold text-xl">TutorHub</span>
          </div>

          <div className="flex-1 flex flex-col justify-center max-w-lg">
            <div className="inline-flex items-center gap-2 self-start bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-5 text-white/80 text-xs font-medium">
              <Sparkles className="h-3.5 w-3.5" /> Nền tảng học tập Hybrid
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold text-white leading-tight mb-4">
              Bắt đầu hành trình<br />học tập cùng TutorHub
            </h1>
            <p className="text-white/70 text-lg mb-8">
              Đăng ký nhập học chỉ trong 1 phút. Trung tâm sẽ đánh giá và xếp lớp phù hợp nhất cho học viên.
            </p>

            <ul className="space-y-3 mb-10">
              {HIGHLIGHTS.map(h => (
                <li key={h} className="flex items-center gap-3 text-white/80 text-sm">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" /> {h}
                </li>
              ))}
            </ul>

            <Link href="/enroll">
              <Button size="lg" className="bg-white text-indigo-900 hover:bg-white/90 font-bold h-12 px-8">
                Đăng ký học ngay <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </Link>
          </div>

          <p className="text-white/40 text-xs mt-10">© 2025 TutorHub · Nền tảng Hybrid Learning</p>
        </div>
      </div>

      {/* RIGHT PANEL — Login Form */}
      <div className="w-full lg:w-[45%] flex items-center justify-center p-8 bg-background relative shadow-[-20px_0_40px_rgba(0,0,0,0.1)] z-20">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center lg:text-left">
            <h2 className="text-3xl font-bold text-foreground">Chào mừng trở lại</h2>
            <p className="text-muted-foreground mt-2 text-sm">Đăng nhập vào cổng thông tin TutorHub</p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Email / Tên đăng nhập</label>
              <Input
                type="text"
                placeholder="ban@tutorhub.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail className="h-4 w-4" />}
                required
                className="h-12"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">Mật khẩu</label>
                <Link href="#" className="text-xs text-primary hover:underline font-medium">
                  Quên mật khẩu?
                </Link>
              </div>
              <Input
                type={showPass ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="h-4 w-4" />}
                rightIcon={
                  <button type="button" onClick={() => setShowPass(!showPass)}>
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
                required
                className="h-12"
              />
            </div>

            {loginError && (
              <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-4 py-3 rounded-xl border border-red-200 dark:border-red-800 animate-in slide-in-from-top-2">
                {loginError}
              </div>
            )}

            <Button
              type="submit"
              variant="gradient"
              size="lg"
              className="w-full h-12 text-base"
              disabled={loginLoading}
            >
              {loginLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Đang đăng nhập...
                </span>
              ) : (
                <>Đăng nhập <ArrowRight className="h-5 w-5 ml-2" /></>
              )}
            </Button>
          </form>

          {/* Chưa có tài khoản */}
          <p className="text-center text-sm text-muted-foreground mt-5">
            Chưa có tài khoản?{" "}
            <Link href="/enroll" className="text-primary font-semibold hover:underline">
              Đăng ký học
            </Link>
          </p>

          {/* Divider */}
          <div className="flex items-center gap-3 my-8">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Đăng nhập trải nghiệm</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Demo role buttons */}
          <div className="grid grid-cols-2 gap-3">
            {DEMO_USERS.map((demo) => (
              <button
                key={demo.role}
                onClick={() => handleDemo(demo.email, demo.role)}
                disabled={loginLoading}
                className="group flex flex-col items-center gap-2 p-3 rounded-2xl border border-border bg-card hover:border-primary/30 transition-all hover:shadow-md"
              >
                <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${demo.color} flex items-center justify-center text-lg shadow-sm group-hover:scale-110 transition-transform`}>
                  {demo.icon}
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">{demo.label}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
