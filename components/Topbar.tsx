"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useBrand } from "@/lib/store";

const QUICK_TABS = [
  { href: "/", label: "홈" },
  { href: "/create", label: "✦ 만들기" },
  { href: "/trends", label: "🔥 트렌드" },
  { href: "/recommend", label: "오늘 추천" },
  { href: "/calendar", label: "캘린더" },
  { href: "/library", label: "보관함" },
  { href: "/templates", label: "템플릿" },
  { href: "/history", label: "발행 이력" },
  { href: "/brand", label: "브랜드" },
  { href: "/settings", label: "설정" },
];

const FULL_MENUS = [
  { href: "/", label: "Dashboard", icon: "◧", desc: "오늘 할 일" },
  { href: "/create", label: "당근 소식 만들기", icon: "✦", desc: "AI 작성", hot: true },
  { href: "/recommend", label: "오늘 추천", icon: "✿", desc: "5 picks" },
  { href: "/trends", label: "인기 주제 찾기", icon: "🔥", desc: "YouTube 분석" },
  { href: "/create#images", label: "소식 이미지", icon: "◫", desc: "글속성 생성" },
  { href: "/calendar", label: "콘텐츠 캘린더", icon: "▦", desc: "예약 관리" },
  { href: "/library", label: "콘텐츠 보관함", icon: "▤", desc: "검색 및 재활용" },
  { href: "/templates", label: "템플릿", icon: "⧉", desc: "형식 저장" },
  { href: "/history", label: "발행 이력", icon: "↗", desc: "기록" },
  { href: "/brand", label: "브랜드 설정", icon: "●", desc: "업체 정보" },
  { href: "/settings", label: "설정", icon: "⚙", desc: "말투·지점·확장" },
];

export default function Topbar({ title, sub }: { title: string; sub?: string }) {
  const path = usePathname();
  const { brand, branches, activeBranchId, switchBranch } = useBrand();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // 페이지 이동 시 드로어 자동 닫기
  useEffect(() => {
    setDrawerOpen(false);
  }, [path]);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-neutral-200">
      {/* 1열: 브랜드 로고 + 지점 표시 + 햄버거 버튼 */}
      <div className="px-5 lg:px-8 py-2.5 flex items-center justify-between gap-2">
        <Link href="/" className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0" style={{ background: "var(--brand)" }}>
            🥕
          </div>
          <div className="min-w-0">
            <div className="font-extrabold tracking-tight text-[15px] leading-tight flex items-center gap-1.5">
              <span>당근 Post AI</span>
            </div>
            <div className="text-[11px] text-neutral-400 truncate leading-none mt-0.5">
              {brand.businessName || "내 비즈니스"}
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-2 shrink-0">
          <Link href="/create" className="btn-primary text-[11.5px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1">
            <span>✦ 작성</span>
          </Link>
          <button
            onClick={() => setDrawerOpen(!drawerOpen)}
            aria-label="전체 메뉴 열기"
            className="w-9 h-9 rounded-xl border border-neutral-200 bg-white flex items-center justify-center text-neutral-700 hover:bg-neutral-50 transition text-[15px] font-bold"
          >
            {drawerOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* 2열: 부드러운 가로 스크롤 탭 메뉴 */}
      <nav className="px-4 lg:px-8 py-1 flex gap-0.5 overflow-x-auto no-scrollbar border-t border-neutral-100 bg-neutral-50/60 text-[11.5px] font-semibold">
        {QUICK_TABS.map((t) => {
          const active = path === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`px-3 py-1 rounded-lg whitespace-nowrap transition ${
                active
                  ? "bg-neutral-900 text-white font-bold shadow-sm"
                  : "text-neutral-500 hover:text-black hover:bg-neutral-200/50"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      {/* 3열: 페이지 타이틀 (지정된 경우에만 표시) */}
      {title && (
        <div className="px-5 lg:px-8 py-2.5 border-t border-neutral-100 bg-white">
          <div className="text-[17px] font-extrabold tracking-tight">{title}</div>
          {sub && <div className="text-[12px] text-neutral-400 mt-0.5">{sub}</div>}
        </div>
      )}

      {/* 모바일 전체 메뉴 슬라이드 드로어 */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-end animate-fadeUp"
          onClick={() => setDrawerOpen(false)}
        >
          <div
            className="w-[290px] h-full bg-white shadow-2xl flex flex-col p-5 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-black text-xs" style={{ background: "var(--brand)" }}>
                  🥕
                </div>
                <span className="font-black text-[15px]">전체 메뉴</span>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="w-8 h-8 rounded-lg bg-neutral-100 text-neutral-600 flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {/* 사업장 전환 셀렉터 */}
            <div className="mt-4 rounded-xl bg-neutral-900 text-white p-3">
              <div className="text-[11.5px] opacity-70">현재 사업장 · 전환</div>
              <select
                value={activeBranchId}
                onChange={(e) => switchBranch(e.target.value)}
                className="mt-1.5 w-full bg-white/10 rounded-lg text-[12.5px] font-bold px-2.5 py-1.5 outline-none cursor-pointer hover:bg-white/15 transition [&>option]:text-black"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            {/* 전체 메뉴 링크 */}
            <nav className="mt-4 flex-1 space-y-1">
              {FULL_MENUS.map((m) => {
                const active = path === m.href;
                if (m.hot) {
                  return (
                    <Link
                      key={m.href}
                      href={m.href}
                      onClick={() => setDrawerOpen(false)}
                      className="block rounded-xl px-3.5 py-2.5 text-white font-bold transition my-1.5"
                      style={{ background: "var(--brand)" }}
                    >
                      <div className="flex items-center gap-2">
                        <span>{m.icon}</span>
                        <span className="text-[13.5px]">{m.label}</span>
                        <span className="ml-auto text-[10px] bg-white/30 rounded-full px-2 py-0.5">핵심</span>
                      </div>
                    </Link>
                  );
                }
                return (
                  <Link
                    key={m.href}
                    href={m.href}
                    onClick={() => setDrawerOpen(false)}
                    className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium transition ${
                      active ? "bg-neutral-900 text-white font-bold" : "text-neutral-600 hover:bg-neutral-100"
                    }`}
                  >
                    <span className="w-5 text-center text-[14px]">{m.icon}</span>
                    <span>{m.label}</span>
                    {m.desc && <span className="ml-auto text-[11px] text-neutral-400">{m.desc}</span>}
                  </Link>
                );
              })}
            </nav>

            {/* 하단 링크 */}
            <div className="pt-4 border-t border-neutral-100">
              <Link
                href="/settings#extension"
                onClick={() => setDrawerOpen(false)}
                className="block text-center rounded-xl bg-neutral-50 border border-neutral-200 py-2.5 text-[12px] font-bold text-neutral-600 hover:bg-neutral-100 transition"
              >
                ⚙ Chrome 확장 프로그램 연동 가이드
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
