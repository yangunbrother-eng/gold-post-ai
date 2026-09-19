import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "당근 Post AI — 당근 소식 자동화 시스템",
  description: "AI 기반 당근 비즈프로필 소식 작성·관리·발행 시스템"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
