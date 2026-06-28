"use client";

import { useState, useRef, useEffect } from "react";
import PortalLayout from "@/components/layout/PortalLayout";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Send, Paperclip, Phone, Info, Check, CheckCheck } from "lucide-react";

// Mock Data
const CONTACTS = [
  {
    id: "c1",
    name: "Thầy Hùng Toán",
    role: "Giáo viên môn Toán",
    avatar: "H",
    online: true,
    lastActive: "Vừa xong",
    unread: 0,
    messages: [
      { id: "m1", senderId: "c1", text: "Chào anh Minh, tôi là Hùng dạy môn Toán lớp 12 của cháu Tuấn.", time: "09:00", isRead: true },
      { id: "m2", senderId: "me", text: "Vâng chào thầy, thầy cho tôi hỏi tình hình học tập của cháu dạo này thế nào ạ?", time: "09:05", isRead: true },
      { id: "m3", senderId: "c1", text: "Cháu Tuấn dạo này làm bài tập rất đầy đủ, tư duy hình học không gian tốt. Tuy nhiên phần nguyên hàm tích phân cần luyện thêm.", time: "09:12", isRead: true },
      { id: "m4", senderId: "me", text: "Dạ nhờ thầy rèn thêm cho cháu phần đó giúp gia đình với ạ. Cảm ơn thầy.", time: "09:15", isRead: true },
      { id: "m5", senderId: "c1", text: "Anh yên tâm, tôi đã giao thêm bài tập chuyên đề cho cháu rồi.", time: "09:20", isRead: true },
    ]
  },
  {
    id: "c2",
    name: "Cô Lan Anh Hóa",
    role: "Giáo viên môn Hóa",
    avatar: "L",
    online: false,
    lastActive: "2 giờ trước",
    unread: 2,
    messages: [
      { id: "m1", senderId: "c2", text: "Chào phụ huynh em Thảo My.", time: "Hôm qua", isRead: true },
      { id: "m2", senderId: "c2", text: "Kỳ thi thử vừa rồi My làm bài khá tốt, điểm cao nhất lớp.", time: "Hôm qua", isRead: true },
      { id: "m3", senderId: "c2", text: "Tuy nhiên phụ huynh nhắc bé ôn lại bài 3 phần Hữu cơ nhé, phần đó My hay làm ẩu.", time: "14:30", isRead: false },
      { id: "m4", senderId: "c2", text: "Tối nay tôi sẽ gửi file bài tập lên hệ thống.", time: "14:31", isRead: false },
    ]
  },
  {
    id: "c3",
    name: "Ban Giáo Vụ TutorHub",
    role: "Hỗ trợ phụ huynh",
    avatar: "TH",
    online: true,
    lastActive: "Vừa xong",
    unread: 0,
    messages: [
      { id: "m1", senderId: "c3", text: "TutorHub xin chào! Quý phụ huynh cần hỗ trợ thông tin gì ạ?", time: "T2", isRead: true },
      { id: "m2", senderId: "me", text: "Tôi vừa chuyển khoản học phí tháng 5 cho 2 bé.", time: "T2", isRead: true },
      { id: "m3", senderId: "c3", text: "Dạ vâng, hệ thống đã xác nhận nhận được khoản thanh toán 2.700.000 VNĐ. Biên lai điện tử đã được cập nhật.", time: "T2", isRead: true },
    ]
  }
];

export default function ParentMessagesPage() {
  const [contacts, setContacts] = useState(CONTACTS);
  const [activeContactId, setActiveContactId] = useState(CONTACTS[0].id);
  const [inputText, setInputText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeContact = contacts.find(c => c.id === activeContactId) || contacts[0];

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeContact.messages]);

  // Mark as read when opening conversation
  useEffect(() => {
    if (activeContact.unread > 0) {
      setContacts(prev => prev.map(c => 
        c.id === activeContactId ? { ...c, unread: 0, messages: c.messages.map(m => ({...m, isRead: true})) } : c
      ));
    }
  }, [activeContactId, activeContact.unread]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const newMessage = {
      id: `m${Date.now()}`,
      senderId: "me",
      text: inputText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isRead: false
    };

    setContacts(prev => prev.map(c => {
      if (c.id === activeContactId) {
        return { ...c, messages: [...c.messages, newMessage] };
      }
      return c;
    }));
    
    setInputText("");
  };

  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <PortalLayout role="parent" userName="Trần Văn Minh" pageTitle="Tin nhắn">
      <div className="max-w-6xl mx-auto h-[calc(100vh-100px)] pb-6 flex flex-col">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-foreground">Tin nhắn & Trao đổi</h1>
          <p className="text-sm text-muted-foreground">Kênh liên lạc trực tiếp với Giáo viên và Ban Giáo vụ TutorHub.</p>
        </div>

        <Card className="flex-1 border-0 shadow-lg overflow-hidden flex flex-col md:flex-row bg-background">
          
          {/* Sidebar / Contacts List */}
          <div className={`w-full md:w-80 border-r border-border flex flex-col bg-card ${activeContactId ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-4 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Tìm kiếm giáo viên..." 
                  className="pl-9 bg-muted/50 border-0 h-10 rounded-xl focus-visible:ring-1"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredContacts.map(contact => {
                const lastMessage = contact.messages[contact.messages.length - 1];
                const isSelected = activeContactId === contact.id;
                
                return (
                  <button
                    key={contact.id}
                    onClick={() => setActiveContactId(contact.id)}
                    className={`w-full text-left p-3 rounded-xl transition-colors flex gap-3 items-center ${
                      isSelected 
                        ? 'bg-primary/10 hover:bg-primary/15' 
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <Avatar className="h-12 w-12 border border-border/50">
                        <AvatarFallback className={isSelected ? 'bg-primary text-primary-foreground font-bold' : 'bg-muted text-foreground font-semibold'}>
                          {contact.avatar}
                        </AvatarFallback>
                      </Avatar>
                      {contact.online && (
                        <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-card rounded-full" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-0.5">
                        <h4 className={`text-sm truncate ${isSelected ? 'font-bold text-primary' : 'font-semibold text-foreground'}`}>
                          {contact.name}
                        </h4>
                        <span className={`text-[10px] shrink-0 ${contact.unread > 0 ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                          {lastMessage?.time}
                        </span>
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        <p className={`text-xs truncate ${contact.unread > 0 ? 'text-foreground font-bold' : 'text-muted-foreground'}`}>
                          {lastMessage?.senderId === "me" ? "Bạn: " : ""}{lastMessage?.text}
                        </p>
                        {contact.unread > 0 && (
                          <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shrink-0">
                            {contact.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chat Window */}
          <div className={`flex-1 flex flex-col ${!activeContactId ? 'hidden md:flex' : 'flex'}`}>
            {activeContact ? (
              <>
                {/* Chat Header */}
                <div className="h-16 px-4 md:px-6 border-b border-border flex items-center justify-between bg-card/50 backdrop-blur-sm z-10 shrink-0">
                  <div className="flex items-center gap-3">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="md:hidden -ml-2 h-8 w-8 text-muted-foreground"
                      onClick={() => setActiveContactId("")}
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <Avatar className="h-10 w-10 border border-border/50">
                      <AvatarFallback className="bg-primary/10 text-primary font-bold">{activeContact.avatar}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">{activeContact.name}</h3>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        {activeContact.online ? (
                          <><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"/> Đang hoạt động</>
                        ) : (
                          `Hoạt động: ${activeContact.lastActive}`
                        )}
                        <span className="mx-1">•</span> {activeContact.role}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground h-9 w-9 rounded-full">
                      <Phone className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground h-9 w-9 rounded-full">
                      <Info className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-muted/10 relative">
                  <div className="text-center mb-6">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
                      Bắt đầu cuộc trò chuyện
                    </span>
                  </div>
                  
                  {activeContact.messages.map((msg, idx) => {
                    const isMe = msg.senderId === "me";
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`flex max-w-[75%] lg:max-w-[65%] ${isMe ? 'flex-row-reverse' : 'flex-row'} gap-2 items-end`}>
                          
                          {!isMe && (
                            <Avatar className="h-6 w-6 shrink-0 mb-1">
                              <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">{activeContact.avatar}</AvatarFallback>
                            </Avatar>
                          )}
                          
                          <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                            <div 
                              className={`px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                                isMe 
                                  ? 'bg-primary text-primary-foreground rounded-br-sm' 
                                  : 'bg-card text-foreground border border-border rounded-bl-sm'
                              }`}
                            >
                              <p className="leading-relaxed">{msg.text}</p>
                            </div>
                            <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground px-1">
                              <span>{msg.time}</span>
                              {isMe && (
                                msg.isRead ? <CheckCheck className="h-3 w-3 text-blue-500" /> : <Check className="h-3 w-3" />
                              )}
                            </div>
                          </div>
                          
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-card border-t border-border shrink-0">
                  <form onSubmit={handleSendMessage} className="flex items-end gap-2 max-w-4xl mx-auto">
                    <Button type="button" variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full">
                      <Paperclip className="h-5 w-5" />
                    </Button>
                    <div className="flex-1 relative">
                      <Input 
                        placeholder="Nhập tin nhắn..." 
                        className="bg-muted/50 border-0 rounded-2xl px-4 py-6 focus-visible:ring-1 focus-visible:bg-background"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                      />
                    </div>
                    <Button 
                      type="submit" 
                      size="icon" 
                      variant="gradient"
                      className="shrink-0 rounded-full h-12 w-12 shadow-sm"
                      disabled={!inputText.trim()}
                    >
                      <Send className="h-5 w-5 ml-0.5" />
                    </Button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-muted/10">
                <div className="h-20 w-20 bg-muted/50 rounded-full flex items-center justify-center mb-4">
                  <Send className="h-8 w-8 opacity-50" />
                </div>
                <p className="text-lg font-medium">Chọn một cuộc trò chuyện</p>
                <p className="text-sm opacity-70">Trao đổi với giáo viên hoặc ban giáo vụ</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </PortalLayout>
  );
}

// ChevronLeft icon fallback since it wasn't imported from lucide-react above
function ChevronLeft(props: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m15 18-6-6 6-6"/></svg>;
}
