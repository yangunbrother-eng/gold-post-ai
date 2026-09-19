import type { Metadata } from "next";
import "./globals.css";
import "./workspace.css";

export const metadata: Metadata = {
  title: "당근 Post AI — 우리 매장 소식 작업실",
  description: "주제 찾기부터 글 작성, 이미지, 발행 준비까지 한곳에서 관리하세요."
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ko"><body>{children}</body></html>;
}
