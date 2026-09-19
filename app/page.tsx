"use client";
import Link from "next/link";
import { useMemo } from "react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { StatusBadge, TypeBadge } from "@/components/PhonePreview";
import { useBrand, useContents, todayStr } from "@/lib/store";

const QUICK_TOPICS = ["오늘의 시세", "고객 후기", "영업 안내", "FAQ"];

export default function Dashboard() {
  const { items } = useContents();
  const { brand } = useBrand();
  const today = todayStr();

  const stats = useMemo(() => {
    const weekAgo = Date.now() - 7 * 864e5;
    return {
      todayMade: items.filter((i) => i.createdAt === today).length,
      needReview: items.filter((i) => i.status === "AI 작성 완료").length,
      reserved: items.filter((i) => i.status === "발행 예정").length,
      weekMade: items.filter((i) => new Date(i.createdAt).getTime() >= weekAgo).length,
    };
  }, [items, today]);

  const todos = [
    { label: `오늘 발행 예정`, count: items.filter((i) => i.date === today && (i.status === "발행 예정" || i.status === "검수 완료")).length, action: "/calendar" },
    { label: `작성 필요`, count: items.filter((i) => i.status === "작성 필요").length, action: "/calendar" },
    { label: `검수 대기`, count: items.filter((i) => i.status === "AI 작성 완료").length, action: "/library" },
  ];

  const trends = ["금값 상승", "돌반지", "지금 팔아야 하나", "18K 매입", "금테크"];

  const recommends = [
    { t: "고객 후기", d: "최근 후기 글이 적습니다", ex: "“여기서 팔길 잘했어요” 실제 방문 후기" },
    { t: "FAQ", d: "“이것도 되나요?” 반복 질문", ex: "많이 묻는 질문 3가지" },
    { t: "시세", d: "금값 변동이 큽니다", ex: "오늘 금값, 지금 팔아도 될까요?" },
    { t: "방문 유도", d: "주말 방문 유도 타이밍", ex: "처음 오시는 분 필독! 주차 안내" },
  ];

  return (
    <div className="min-h-screen flex">
      <Sidebar bizName={brand.businessName} extConnected={false} />
      <div className="flex-1 min-w-0">
        <Topbar title="Dashboard" sub="오늘 당근 업무를 한눈에" />
        <main className="max-w-[1120px] mx-auto px-4 lg:px-8 py-6 space-y-5">

          {/* 히어로 — 인사 + 핵심 액션 + 빠른 주제 */}
          <section className="rounded-2xl p-5 lg:p-6 text-white animate-fadeUp overflow-hidden relative" style={{ background: "linear-gradient(135deg,#241B10 0%,#3A2C18 60%,#4d3a1e 100%)", border: "1px solid #C9A22733" }}>
            <div className="absolute -right-10 -top-16 text-[160px] leading-none opacity-[0.07] select-none pointer-events-none">金</div>
            <div className="flex flex-wrap items-start justify-between gap-3 relative">
              <div>
                <div className="text-[12px] font-semibold tracking-[0.14em]" style={{ color: "#D8BC6A" }}>{today} · {brand.businessName}</div>
                <h2 className="mt-1 text-[20px] font-black tracking-tight leading-snug">오늘 당근에 어떤 소식을 올릴까요?</h2>
              </div>
              <Link href="/create" className="btn-gold text-[13px] font-bold px-5 py-2.5 w-full sm:w-auto text-center shrink-0">✦ AI 소식 만들기</Link>
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5 relative">
              {QUICK_TOPICS.map((t) => (
                <Link key={t} href={`/create?topic=${encodeURIComponent(t)}`}
                  className="rounded-lg px-3 py-1.5 text-[12px] font-semibold transition hover:bg-white/20" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(216,188,106,0.35)", color: "#F3E9D2" }}>{t}</Link>
              ))}
            </div>
          </section>

          {/* 핵심 숫자 — 4개로 압축 */}
          <section className="card px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              ["오늘 생성", stats.todayMade],
              ["검수 대기", stats.needReview],
              ["발행 예정", stats.reserved],
              ["이번 주 작성", stats.weekMade],
            ].map(([l, v]) => (
              <div key={l as string}>
                <div className="label">{l}</div>
                <div className="text-[22px] font-black tracking-tight mt-0.5">{v}<span className="text-[12px] font-semibold text-neutral-400 ml-1">건</span></div>
              </div>
            ))}
          </section>

          <div className="grid lg:grid-cols-[1fr_340px] gap-5 items-start">
            <div className="space-y-5 min-w-0">
              {/* 추천 주제 — 2x2 */}
              <section className="card p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-[15px] font-extrabold tracking-tight">✦ 오늘 추천 주제</h3>
                  <Link href="/recommend" className="text-[12px] font-bold text-neutral-400 hover:text-black">전체 보기 →</Link>
                </div>
                <div className="mt-3 grid sm:grid-cols-2 gap-2.5">
                  {recommends.map((r) => (
                    <div key={r.t} className="rounded-xl border border-neutral-200 p-4 hover:border-neutral-400 transition">
                      <div className="flex items-center gap-2">
                        <TypeBadge type={r.t} />
                        <span className="text-[12px] text-neutral-500">{r.d}</span>
                      </div>
                      <div className="mt-2 text-[13px] font-bold tracking-tight leading-snug">“{r.ex}”</div>
                      <Link href={`/create?topic=${encodeURIComponent(r.ex)}`} className="mt-2.5 inline-block text-[12px] font-bold btn-ghost px-3 py-1.5">바로 만들기 →</Link>
                    </div>
                  ))}
                </div>
              </section>

              {/* 최근 콘텐츠 */}
              <section className="card p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-[15px] font-extrabold tracking-tight">최근 콘텐츠</h3>
                  <Link href="/history" className="text-[12px] font-bold text-neutral-400 hover:text-black">이력 전체 →</Link>
                </div>
                <div className="mt-2 divide-y divide-neutral-100">
                  {items.slice(0, 5).map((c) => (
                    <div key={c.id} className="py-2.5 flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-bold truncate">{c.title}</div>
                        <div className="text-[12px] text-neutral-400 mt-0.5">{c.date} <span className="dot" />{c.type}</div>
                      </div>
                      <StatusBadge status={c.status} />
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* 우측 rail */}
            <div className="space-y-5">
              <section className="card p-5">
                <h3 className="text-[15px] font-extrabold tracking-tight">오늘 해야 할 일</h3>
                <div className="mt-3 space-y-1">
                  {todos.map((t) => (
                    <Link key={t.label} href={t.action} className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 hover:bg-neutral-50 transition">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${t.count > 0 ? "bg-[var(--brand)]" : "bg-neutral-200"}`} />
                      <span className="text-[13px] font-semibold flex-1">{t.label}</span>
                      <span className="text-[13px] font-black">{t.count}건</span>
                    </Link>
                  ))}
                </div>
              </section>

              <section className="card p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-[15px] font-extrabold tracking-tight">콘텐츠 트렌드</h3>
                  <Link href="/trends" className="text-[12px] font-bold text-neutral-400 hover:text-black">분석 →</Link>
                </div>
                <div className="mt-3 space-y-1">
                  {trends.map((t, i) => (
                    <Link key={t} href={`/create?topic=${encodeURIComponent(t + " 관련 당근 소식")}`}
                      className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 hover:bg-neutral-50 transition">
                      <span className="text-[12px] font-black text-neutral-300 w-4">{i + 1}</span>
                      <span className="text-[13px] font-semibold flex-1 truncate">#{t}</span>
                      <span className="text-[12px] font-bold text-neutral-400">→</span>
                    </Link>
                  ))}
                </div>
              </section>

              <section className="card p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-[15px] font-extrabold tracking-tight">이번 주 예약 플랜</h3>
                  <Link href="/calendar" className="text-[12px] font-bold text-neutral-400 hover:text-black">캘린더 →</Link>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-1.5">
                  {[["월", "금 시세"], ["화", "고객 후기"], ["수", "정보 콘텐츠"], ["목", "FAQ"], ["금", "매입 사례"], ["토", "방문 유도"]].map(([d, t]) => (
                    <div key={d} className="flex items-center gap-2 rounded-lg bg-neutral-50 border border-neutral-100 px-2.5 py-2">
                      <span className="text-[12px] font-black text-neutral-400">{d}</span>
                      <span className="text-[12px] font-semibold truncate">{t}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
