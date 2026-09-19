"use client";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { TypeBadge } from "@/components/PhonePreview";
import { useBrand, useContents } from "@/lib/store";

const RECS = [
  { type: "고객 후기", title: "“여기서 팔길 잘했어요” 실제 방문 후기", why: "최근 7일간 후기형 0건 — 신뢰 콘텐츠가 비어 있습니다.", prompt: "어제 방문한 고객 후기 활용해서 신뢰감 있는 글" },
  { type: "FAQ", title: "많이 묻는 질문 3가지", why: "“끊어져도 되나요?” 반복 문의가 늘고 있습니다.", prompt: "처음 오는 고객이 가장 궁금해하는 질문 3가지 정리" },
  { type: "시세", title: "오늘 금값, 지금 팔아도 될까요?", why: "금값 변동 +3.2% — 오늘 시세 글이 필요합니다.", prompt: "오늘 금값이 많이 올랐는데 지금 팔아도 되는지 궁금해하는 고객용 글" },
  { type: "방문 안내", title: "처음 오시는 분 필독! 주차 안내", why: "주말 방문 전환율이 높은 요일입니다.", prompt: "처음 방문하는 고객을 위한 위치·주차·준비물 안내 글" },
  { type: "영업 안내", title: "이번 주말도 정상 영업합니다", why: "일요일 영업 안내는 미리 예약하면 도달률이 높습니다.", prompt: "이번 주말 정상 영업한다는 안내 글" }
];

export default function Recommend() {
  const { brand } = useBrand();
  const { items } = useContents();
  return (
    <div className="min-h-screen flex">
      <Sidebar bizName={brand.businessName} extConnected={false} />
      <div className="flex-1 min-w-0">
        <Topbar title="오늘 추천" sub="최근 이력 기반 5 picks" />
        <main className="max-w-[1000px] mx-auto px-4 lg:px-8 py-6 space-y-4">
          <div className="hidden lg:block">
            <h1 className="text-[26px] font-black tracking-tight">✦ 오늘 추천 주제</h1>
            <p className="text-[13.5px] text-neutral-500">보관함 {items.length}건 분석 · 부족한 유형 우선 추천</p>
          </div>
          <div className="grid gap-3">
            {RECS.map((r, i) => (
              <div key={r.title} className="card p-5 flex flex-col sm:flex-row sm:items-center gap-4 animate-fadeUp" style={{ animationDelay: `${i * 60}ms` }}>
                <div className="w-11 h-11 rounded-2xl bg-neutral-900 text-white font-black flex items-center justify-center text-[18px] shrink-0">{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2"><TypeBadge type={r.type} /><span className="text-[12px] text-neutral-500 font-medium">{r.why}</span></div>
                  <div className="mt-1.5 text-[16px] font-extrabold tracking-tight">“{r.title}”</div>
                </div>
                <Link href={`/create?topic=${encodeURIComponent(r.prompt)}`} className="btn-primary text-[13px] px-5 py-3 font-bold shrink-0 text-center">바로 만들기 →</Link>
              </div>
            ))}
          </div>
          <div className="card p-5 text-[13px] text-neutral-500">중복 방지: 생성 시 최근 8건과 문구 유사도를 자동 비교합니다. 55% 이상이면 경고를 표시합니다.</div>
        </main>
      </div>
    </div>
  );
}
