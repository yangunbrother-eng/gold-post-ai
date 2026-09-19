import type { Metadata } from "next";
import AdsDashboard from "@/components/AdsDashboard";
export const metadata: Metadata = {
  title: "광고 분석 | 당근 Post AI",
  description: "당근 광고 MCP 조회 결과와 광고 보고서로 광고비, 클릭률, 클릭당 비용과 소재별 성과를 비교하세요.",
};
export default function AdsPage() { return <AdsDashboard />; }
