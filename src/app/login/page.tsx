"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GraduationCap, Mail, Lock, Eye, EyeOff, ArrowRight, User, Users, Phone, BookOpen, Target, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

const DEMO_USERS = [
  { role: "student", email: "student@tutorhub.com", label: "Học viên", color: "from-indigo-500 to-purple-600", icon: "🎓" },
  { role: "parent", email: "parent@tutorhub.com", label: "Phụ huynh", color: "from-teal-500 to-emerald-600", icon: "👨‍👩‍👧" },
  { role: "teacher", email: "teacher@tutorhub.com", label: "Giáo viên", color: "from-amber-500 to-orange-600", icon: "👨‍🏫" },
  { role: "admin", email: "admin@tutorhub.com", label: "Quản trị viên", color: "from-rose-500 to-pink-600", icon: "⚙️" },
];

const SUBJECTS = ["Toán học", "Vật lý", "Hóa học", "Tiếng Anh", "Ngữ Văn"];

export default function LoginPage() {
  const router = useRouter();
  
  // Login State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  // Register State
  const [regData, setRegData] = useState({
    studentName: "", studentPhone: "", parentName: "", parentPhone: "",
    grade: "", school: "", subjects: [] as string[], targetScore: "", package: ""
  });
  const [regLoading, setRegLoading] = useState(false);
  const [regSuccess, setRegSuccess] = useState(false);

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

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setLoginError("Email hoặc mật khẩu không đúng.");
        setLoginLoading(false);
        return;
      }

      // Get role from profiles table
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

      const role = profile?.role ?? "student";
      router.push(`/${role}`);
    } catch {
      setLoginError("Đã có lỗi xảy ra. Vui lòng thử lại.");
      setLoginLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegLoading(true);
    // Simulate API call to save admission data
    setTimeout(() => {
      setRegLoading(false);
      setRegSuccess(true);
    }, 1500);
  };

  const toggleSubject = (sub: string) => {
    setRegData(prev => ({
      ...prev,
      subjects: prev.subjects.includes(sub) 
        ? prev.subjects.filter(s => s !== sub)
        : [...prev.subjects, sub]
    }));
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row relative overflow-hidden bg-background">
      
      {/* LEFT PANEL — Admission Registration Form */}
      <div className="w-full lg:w-[60%] relative overflow-y-auto bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-300" />
        
        <div className="relative z-10 p-8 lg:p-12 min-h-full flex flex-col">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-10 w-10 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <span className="text-white font-bold text-xl">TutorHub</span>
          </div>

          <div className="mb-8">
            <h1 className="text-3xl lg:text-4xl font-bold text-white mb-3">Đăng ký Nhập học</h1>
            <p className="text-white/70 text-lg">Điền thông tin chi tiết bên dưới để Trung tâm đánh giá và phân bổ lớp học phù hợp nhất cho học viên.</p>
          </div>

          {regSuccess ? (
            <div className="bg-white/10 backdrop-blur-md border border-emerald-500/30 rounded-2xl p-8 text-center animate-fade-in flex-1 flex flex-col justify-center items-center">
              <div className="h-20 w-20 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6">
                <CheckCircle2 className="h-10 w-10 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Đăng ký thành công!</h2>
              <p className="text-white/80 max-w-md">
                Thông tin của bạn đã được gửi đến ban giáo vụ TutorHub. Chúng tôi sẽ liên hệ qua số điện thoại phụ huynh trong vòng 24h để làm bài test đầu vào và xếp lớp.
              </p>
              <Button 
                variant="outline" 
                className="mt-8 bg-white/5 border-white/20 text-white hover:bg-white/10"
                onClick={() => setRegSuccess(false)}
              >
                Gửi thêm đăng ký
              </Button>
            </div>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 lg:p-8 animate-fade-in flex-1">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Học viên */}
                <div className="space-y-4">
                  <h3 className="text-white font-semibold flex items-center gap-2 border-b border-white/10 pb-2">
                    <User className="h-4 w-4 text-indigo-300" /> Thông tin Học viên
                  </h3>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/70">Họ và tên học viên *</label>
                    <Input className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-11" placeholder="Nguyễn Văn A" required value={regData.studentName} onChange={e => setRegData({...regData, studentName: e.target.value})} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/70">Số điện thoại học viên</label>
                    <Input className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-11" placeholder="Tuỳ chọn" value={regData.studentPhone} onChange={e => setRegData({...regData, studentPhone: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-white/70">Lớp *</label>
                      <select className="flex h-11 w-full items-center justify-between rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500" required value={regData.grade} onChange={e => setRegData({...regData, grade: e.target.value})}>
                        <option value="" disabled className="text-gray-900">Chọn lớp</option>
                        <option value="9" className="text-gray-900">Lớp 9</option>
                        <option value="10" className="text-gray-900">Lớp 10</option>
                        <option value="11" className="text-gray-900">Lớp 11</option>
                        <option value="12" className="text-gray-900">Lớp 12</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-white/70">Trường học</label>
                      <Input className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-11" placeholder="VD: THPT Chu Văn An" value={regData.school} onChange={e => setRegData({...regData, school: e.target.value})} />
                    </div>
                  </div>
                </div>

                {/* Phụ huynh */}
                <div className="space-y-4">
                  <h3 className="text-white font-semibold flex items-center gap-2 border-b border-white/10 pb-2">
                    <Users className="h-4 w-4 text-emerald-300" /> Thông tin Phụ huynh
                  </h3>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/70">Họ và tên phụ huynh *</label>
                    <Input className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-11" placeholder="Người giám hộ" required value={regData.parentName} onChange={e => setRegData({...regData, parentName: e.target.value})} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/70">Số điện thoại phụ huynh *</label>
                    <Input type="tel" className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-11" placeholder="Dùng để liên hệ xếp lớp" required value={regData.parentPhone} onChange={e => setRegData({...regData, parentPhone: e.target.value})} />
                  </div>
                </div>
              </div>

              {/* Nhu cầu học tập */}
              <div className="space-y-4 pt-4">
                <h3 className="text-white font-semibold flex items-center gap-2 border-b border-white/10 pb-2">
                  <Target className="h-4 w-4 text-amber-300" /> Đánh giá Nhu cầu
                </h3>
                
                <div className="space-y-2">
                  <label className="text-xs font-medium text-white/70">Môn học cần bồi dưỡng *</label>
                  <div className="flex flex-wrap gap-2">
                    {SUBJECTS.map(sub => (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => toggleSubject(sub)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors border ${
                          regData.subjects.includes(sub) 
                            ? 'bg-indigo-500 text-white border-indigo-400' 
                            : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {sub}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/70">Mục tiêu điểm số (VD: 8.5+ Đại học) *</label>
                    <Input className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-11" placeholder="Mục tiêu đầu ra" required value={regData.targetScore} onChange={e => setRegData({...regData, targetScore: e.target.value})} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/70">Gói học quan tâm *</label>
                    <select className="flex h-11 w-full items-center justify-between rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500" required value={regData.package} onChange={e => setRegData({...regData, package: e.target.value})}>
                      <option value="" disabled className="text-gray-900">Chọn gói học</option>
                      <option value="online" className="text-gray-900">Gói Online (Miễn phí)</option>
                      <option value="advanced" className="text-gray-900">Gói Nâng cao (Online + Tài liệu)</option>
                      <option value="offline" className="text-gray-900">Gói Offline (Học tại trung tâm)</option>
                    </select>
                  </div>
                </div>
              </div>

              <Button type="submit" size="lg" disabled={regLoading} className="w-full bg-white text-indigo-900 hover:bg-white/90 font-bold mt-4">
                {regLoading ? "Đang gửi hồ sơ..." : "Gửi Hồ Sơ Nhập Học"}
              </Button>
            </form>
          )}

          <p className="text-white/40 text-xs mt-8">
            © 2025 TutorHub · Nền tảng Hybrid Learning
          </p>
        </div>
      </div>

      {/* RIGHT PANEL — Login Form */}
      <div className="w-full lg:w-[40%] flex items-center justify-center p-8 bg-background relative shadow-[-20px_0_40px_rgba(0,0,0,0.1)] z-20">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center lg:text-left">
            <h2 className="text-3xl font-bold text-foreground">Chào mừng trở lại</h2>
            <p className="text-muted-foreground mt-2 text-sm">Đăng nhập vào cổng thông tin TutorHub</p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Email đăng nhập</label>
              <Input
                type="email"
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
