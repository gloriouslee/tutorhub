"use client";

import { useState } from "react";
import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SectionHeader } from "@/components/shared";
import { MOCK_CLASS_MATERIALS, MOCK_CLASSES } from "@/lib/mock-data";
import { 
  BookMarked, Download, Search, Filter, Lock, 
  PlayCircle, FileText, ExternalLink, ShoppingCart, 
  X, CheckCircle2, Star, Image as ImageIcon 
} from "lucide-react";

// Mock data for Premium Marketplace (since MOCK_CLASS_MATERIALS doesn't have prices)
const PREMIUM_MATERIALS = [
  { id: "p1", title: "Khóa luyện đề Toán Vận dụng cao (10 đề có đáp án chi tiết)", type: "bundle", subject: "Toán học", price: 150000, purchased: false, rating: 4.8, students: 320, cover: "gradient-1" },
  { id: "p2", title: "Kho bí kíp Hình học Oxyz (Kèm file bài giảng)", type: "bundle", subject: "Toán học", price: 250000, purchased: true, rating: 4.9, students: 512, cover: "gradient-2" },
  { id: "p3", title: "Bộ 50 video mẹo giải Hệ phương trình", type: "video", subject: "Đại Số", price: 100000, purchased: false, rating: 4.7, students: 215, cover: "gradient-3" },
  { id: "p4", title: "Tổng ôn Vật Lý Olympic (Tài liệu độc quyền)", type: "pdf", subject: "Vật lý", price: 90000, purchased: false, rating: 4.9, students: 430, cover: "gradient-4" },
];

export default function StudentMaterialsPage() {
  const [activeTab, setActiveTab] = useState<"class" | "premium">("class");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMat, setSelectedMat] = useState<any>(null);
  const [modalType, setModalType] = useState<"preview" | "purchase" | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [premiumData, setPremiumData] = useState(PREMIUM_MATERIALS);

  const formatVND = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case "video": return <PlayCircle className="h-6 w-6" />;
      case "bundle": return <BookMarked className="h-6 w-6" />;
      case "image": return <ImageIcon className="h-6 w-6" />;
      default: return <FileText className="h-6 w-6" />;
    }
  };

  // Lọc tài liệu theo lớp (mặc định s1 học c1, c2)
  const classMaterials = MOCK_CLASS_MATERIALS.filter(m => ["c1", "c2"].includes(m.class_id));
  
  const filteredClassMaterials = classMaterials.filter(m => 
    m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPremiumMaterials = premiumData.filter(m => 
    m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handlePurchase = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setPremiumData(prev => prev.map(p => p.id === selectedMat.id ? { ...p, purchased: true } : p));
      setIsProcessing(false);
      setModalType(null);
      setSelectedMat(null);
    }, 1500);
  };

  return (
    <PortalLayout role="student" userName="Nguyễn Anh Tuấn" pageTitle="Tài liệu">
      <div className="space-y-8 max-w-6xl mx-auto pb-10">
        
        {/* Banner */}
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-indigo-900 to-purple-900 p-8 sm:p-12 text-white shadow-xl">
          <div className="absolute top-0 right-0 p-8 opacity-20 -translate-y-1/4 translate-x-1/4">
            <BookMarked className="w-64 h-64" />
          </div>
          <div className="relative z-10 max-w-2xl">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">Kho Tài Liệu Điện Tử</h1>
            <p className="text-indigo-100 text-lg mb-8 leading-relaxed">
              Truy cập miễn phí tài liệu từ các lớp đang học hoặc mua thêm các gói tài liệu chuyên sâu để nâng cao thành tích học tập.
            </p>
            <div className="flex bg-white/10 backdrop-blur-md p-1.5 rounded-xl w-fit border border-white/20">
              <button
                onClick={() => setActiveTab("class")}
                className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                  activeTab === "class" ? "bg-white text-indigo-900 shadow-md" : "text-white/80 hover:text-white hover:bg-white/5"
                }`}
              >
                Tài liệu của Lớp
              </button>
              <button
                onClick={() => setActiveTab("premium")}
                className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  activeTab === "premium" ? "bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-md" : "text-white/80 hover:text-white hover:bg-white/5"
                }`}
              >
                Tài liệu Cao cấp <Lock className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-card p-3 rounded-2xl border border-border shadow-sm">
          <div className="flex items-center gap-3 w-full sm:w-auto px-1">
            <div className="relative flex-1 sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                className="pl-9 h-11 bg-muted/50 border-0 rounded-xl" 
                placeholder={activeTab === "class" ? "Tìm kiếm tài liệu bài giảng..." : "Tìm kiếm khóa học, bộ đề..."} 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button size="icon" variant="outline" className="h-11 w-11 shrink-0 rounded-xl border-border/50 bg-muted/50">
              <Filter className="h-5 w-5 text-muted-foreground" />
            </Button>
          </div>
          <div className="text-sm font-semibold text-muted-foreground px-3">
            Hiển thị {activeTab === "class" ? filteredClassMaterials.length : filteredPremiumMaterials.length} kết quả
          </div>
        </div>

        {/* Tab 1: Class Materials */}
        {activeTab === "class" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredClassMaterials.map((mat, i) => {
              const relatedClass = MOCK_CLASSES.find(c => c.id === mat.class_id);
              return (
                <Card key={mat.id} className="group hover:border-primary/50 hover:shadow-lg transition-all animate-fade-in flex flex-col border-border/60" style={{ animationDelay: `${i * 50}ms` }}>
                  <CardContent className="p-5 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                      <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
                        {getFileIcon(mat.file_type)}
                      </div>
                      <Badge variant="outline" className="text-[10px] bg-primary/5 border-primary/20 text-primary font-bold">{mat.file_type.toUpperCase()}</Badge>
                    </div>
                    
                    <h3 className="font-bold text-foreground text-base line-clamp-2 mb-2 group-hover:text-primary transition-colors">
                      {mat.title}
                    </h3>
                    
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-4 leading-relaxed flex-1">
                      {mat.description}
                    </p>
                    
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-medium text-muted-foreground mb-5 bg-muted/30 p-2 rounded-lg">
                      <span className="text-foreground">{relatedClass?.class_name || "Môn học"}</span>
                      <span>{mat.file_size}</span>
                    </div>
                    
                    <div className="mt-auto pt-4 border-t border-border/50 flex gap-3">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1 h-9 rounded-lg font-semibold hover:bg-primary/5"
                        onClick={() => { setSelectedMat(mat); setModalType("preview"); }}
                      >
                        <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Xem
                      </Button>
                      <Button size="sm" variant="gradient" className="flex-1 h-9 rounded-lg font-semibold shadow-md">
                        <Download className="h-3.5 w-3.5 mr-1.5" /> Tải về
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Tab 2: Premium Materials */}
        {activeTab === "premium" && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredPremiumMaterials.map((mat, i) => (
              <Card key={mat.id} className={`group transition-all animate-fade-in flex flex-col overflow-hidden border-2 ${mat.purchased ? 'border-emerald-500/30 shadow-emerald-500/10 shadow-lg' : 'border-border/50 hover:border-amber-500/50 hover:shadow-xl'}`} style={{ animationDelay: `${i * 50}ms` }}>
                {/* Visual Cover */}
                <div className={`h-28 w-full relative overflow-hidden ${
                  mat.cover === 'gradient-1' ? 'bg-gradient-to-r from-violet-500 to-purple-500' :
                  mat.cover === 'gradient-2' ? 'bg-gradient-to-r from-cyan-500 to-blue-500' :
                  mat.cover === 'gradient-3' ? 'bg-gradient-to-r from-rose-400 to-red-500' :
                  'bg-gradient-to-r from-amber-400 to-orange-500'
                }`}>
                  <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
                  {mat.purchased && (
                    <div className="absolute top-3 right-3 bg-white/20 backdrop-blur-md border border-white/30 text-white text-[10px] font-bold uppercase px-3 py-1 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Đã sở hữu
                    </div>
                  )}
                  <div className="absolute bottom-3 left-4 text-white/90">
                    {getFileIcon(mat.type)}
                  </div>
                </div>

                <CardContent className="p-6 flex-1 flex flex-col relative z-10 bg-card">
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant="outline" className="text-xs bg-muted/50 border-border">{mat.subject}</Badge>
                    {!mat.purchased && <span className="font-black text-lg text-amber-600 dark:text-amber-500">{formatVND(mat.price)}</span>}
                  </div>
                  
                  <h3 className="font-bold text-foreground text-lg line-clamp-2 mb-3 mt-1 group-hover:text-amber-600 transition-colors">
                    {mat.title}
                  </h3>
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-6 font-medium mt-auto">
                    <span className="flex items-center gap-1.5 text-amber-500">
                      <Star className="h-4 w-4 fill-amber-500" /> {mat.rating}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-border" />
                    <span>{mat.students} lượt mua</span>
                  </div>
                  
                  <div className="pt-4 border-t border-border">
                    {mat.purchased ? (
                      <div className="flex gap-3">
                        <Button size="sm" variant="outline" className="flex-1 h-10 font-bold text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/30">
                          <ExternalLink className="h-4 w-4 mr-2" /> Học ngay
                        </Button>
                        <Button size="sm" className="flex-1 h-10 font-bold bg-emerald-500 hover:bg-emerald-600 text-white shadow-md">
                          <Download className="h-4 w-4 mr-2" /> Tải về
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-3">
                        <Button size="sm" variant="outline" className="flex-1 h-10 font-bold">
                          Xem thử
                        </Button>
                        <Button 
                          size="sm" 
                          className="flex-[2] h-10 font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md shadow-orange-500/20"
                          onClick={() => { setSelectedMat(mat); setModalType("purchase"); }}
                        >
                          <ShoppingCart className="h-4 w-4 mr-2" /> Mua tài liệu
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {modalType && selectedMat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-lg shadow-2xl border-0 overflow-hidden">
            <div className={`p-6 text-white flex justify-between items-start ${
              modalType === "preview" ? "bg-gradient-to-r from-primary to-purple-600" : "bg-gradient-to-r from-amber-500 to-orange-600"
            }`}>
              <div>
                <h3 className="text-xl font-bold mb-1">
                  {modalType === "preview" ? "Xem tài liệu" : "Xác nhận thanh toán"}
                </h3>
                <p className="text-white/80 text-sm font-medium line-clamp-1">{selectedMat.title}</p>
              </div>
              <Button size="icon" variant="ghost" className="text-white hover:bg-white/20 rounded-full h-8 w-8" onClick={() => { setModalType(null); setSelectedMat(null); }}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            <CardContent className="p-6">
              {modalType === "preview" && (
                <div className="space-y-6">
                  <div className="aspect-video bg-muted/30 rounded-xl border border-border flex flex-col items-center justify-center">
                    {getFileIcon(selectedMat.file_type || selectedMat.type)}
                    <p className="text-sm font-medium text-muted-foreground mt-3">Bản xem trước tài liệu</p>
                  </div>
                  
                  <div className="bg-muted/20 p-4 rounded-xl border border-border">
                    <h4 className="font-bold text-sm mb-2 text-foreground">Chi tiết tệp</h4>
                    <ul className="text-sm space-y-2 text-muted-foreground">
                      <li className="flex justify-between"><span className="font-medium">Tên file:</span> <span>{selectedMat.file_url?.split('/').pop() || 'tai_lieu.pdf'}</span></li>
                      <li className="flex justify-between"><span className="font-medium">Dung lượng:</span> <span>{selectedMat.file_size || 'N/A'}</span></li>
                      <li className="flex justify-between"><span className="font-medium">Ngày đăng:</span> <span>{new Date(selectedMat.created_at || Date.now()).toLocaleDateString('vi-VN')}</span></li>
                    </ul>
                  </div>
                  
                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1 font-bold" onClick={() => setModalType(null)}>Đóng</Button>
                    <Button variant="gradient" className="flex-1 font-bold">
                      <Download className="h-4 w-4 mr-2" /> Tải file gốc
                    </Button>
                  </div>
                </div>
              )}

              {modalType === "purchase" && (
                <div className="space-y-6">
                  <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-xl border border-amber-200 dark:border-amber-900/50">
                    <h4 className="text-amber-800 dark:text-amber-500 font-bold mb-2">Thông tin hóa đơn</h4>
                    <div className="flex justify-between items-center text-sm font-medium mb-1">
                      <span className="text-foreground/80">Sản phẩm:</span>
                      <span className="text-foreground max-w-[200px] truncate">{selectedMat.title}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm font-medium mb-3 pb-3 border-b border-amber-200 dark:border-amber-900/50">
                      <span className="text-foreground/80">Hình thức:</span>
                      <span className="text-foreground">Tài liệu điện tử (File/Video)</span>
                    </div>
                    <div className="flex justify-between items-end">
                      <span className="font-bold text-foreground">Tổng thanh toán:</span>
                      <span className="text-2xl font-black text-amber-600 dark:text-amber-500">{formatVND(selectedMat.price)}</span>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground text-center">
                    Bằng việc xác nhận, số tiền sẽ được trừ vào số dư tài khoản của bạn.
                  </p>

                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1 font-bold" onClick={() => setModalType(null)}>Hủy bỏ</Button>
                    <Button 
                      className="flex-1 font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0"
                      onClick={handlePurchase}
                      disabled={isProcessing}
                    >
                      {isProcessing ? "Đang xử lý..." : "Xác nhận mua"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </PortalLayout>
  );
}
