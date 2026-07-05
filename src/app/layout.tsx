import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "TutorHub — Trung tâm học tập Hybrid",
    template: "%s | TutorHub",
  },
  description:
    "Nền tảng trung tâm gia sư hiện đại hỗ trợ học viên online và offline với lịch học thông minh, theo dõi tiến độ và cộng tác liền mạch.",
  keywords: ["gia sư", "giáo dục", "học tập", "lớp học online", "cổng học viên"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head />
      <body className={`${inter.variable} antialiased min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
