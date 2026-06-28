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
    default: "TutorHub — Hybrid Learning Center",
    template: "%s | TutorHub",
  },
  description:
    "A modern hybrid learning center platform supporting online and offline students with intelligent scheduling, progress tracking, and seamless collaboration.",
  keywords: ["tutoring", "education", "learning", "online classes", "student portal"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body className={`${inter.variable} antialiased min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
