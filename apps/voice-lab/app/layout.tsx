import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Voice Lab · 演讲训练工作台",
  description: "把英文稿件变成更自然、更有节奏的演讲练习。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
