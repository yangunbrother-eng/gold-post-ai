"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Topbar from "@/components/Topbar";
import PopularDaangn from "@/components/PopularDaangn";
import Icon from "@/components/Icon";
import { useBrand, useContents, todayStr } from "@/lib/store";

type GoldRow = {
  id: string;
  name: string;
  sub: string;
  buy: number | null;
  buyLabel?: string;
  sell: number | null;
  buyChange: number | null;
  sellChange: number | null;
  buyPct: number | null;
  sellPct: number | null;
};

type GoldPriceData = {
  source: string;
  sourceUrl: string;
  unit: string;
  fetchedAt: string;
  stale?: boolean;
  rows: GoldRow[];
};

const createLink = (topic: string) => `/create?topic=${encodeURIComponent(topic)}`;
const won = (value: number | null) => value == null ? "–" : Math.round(value).toLocaleString("ko-KR");

function Delta({ value, pct }: { value: number | null; pct: number | null }) {
  const direction = value ?? pct ?? 0;
  const tone = direction > 0 ? "text-rose-300" : direction < 0 ? "text-sky-300" : "text-white/45";
  if (value == null && pct == null) return <span className="text-[10px] text-white/35">변동 정보 없음</span>;
  return (
    <span className={`mt-0.5 block whitespace-nowrap text-[10px] font-medium ${tone}`}>
      {pct != null ? `${Math.abs(pct)}% ` : ""}
      {direction > 0 ? "▲" : direction < 0 ? "▼" : "–"}
      {value != null && value !== 0 ? ` ${Math.abs(Math.round(value)).toLocaleString("ko-KR")}` : ""}
    </span>
  );
}

export default function Dashboard() {
  const { items, loaded } = useContents();
  const { brand } = useBrand();
  const today = todayStr();
  const [gold, setGold] = useState<GoldPriceData | null>(null);
  const [goldLoading, setGoldLoading] = useState(true);
  const [goldError, setGoldError] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const response = await fetch("/api/gold-price", { cache: "no-store" });
        const data = await response.json() as GoldPriceData & { error?: string };
        if (!response.ok || !Array.isArray(data.rows)) throw new Error(data.error || "gold");
        if (!alive) return;
        setGold(data);
        setGoldError(false);
      } catch {
        if (alive) setGoldError(true);
      } finally {
        if (alive) setGoldLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(load, 60_000);
    return () => { alive = false; window.clearInterval(timer); };
  }, []);

  const stats = useMemo(() => ({
    review: items.filter((item) => item.status === "AI 작성 완료").length,
    scheduled: items.filter((item) => item.status === "발행 예정").length,
    drafts: items.filter((item) => item.status === "초안" || item.status === "작성 필요").length,
    published: items.filter((item) => item.status === "발행됨").length,
  }), [items]);

  const recent = useMemo(
    () => [...items].filter((item) => item.status !== "보관").sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3),
    [items]
  );

  const fetchedTime = gold?.fetchedAt
    ? new Date(gold.fetchedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <div className="app-root">
      <Topbar title="" />
      <main id="main-content" className="studio-main" tabIndex={-1}>
        <section className="welcome-heading">
          <p className="eyebrow">{today.replaceAll("-", ".")} · 오늘의 작업 공간</p>
          <h1>오늘도, 반가운 소식 하나.</h1>
          <p>{brand.businessName}의 이야기를 더 쉽게 전해보세요.</p>
        </section>

        <section className="overflow-hidden rounded-[24px] border border-black/10 bg-[#1b1b1b] text-white shadow-[0_12px_30px_rgba(0,0,0,.12)]" aria-labelledby="gold-title">
          <div className="border-b border-white/10 px-4 py-4 sm:px-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-extrabold tracking-[.18em] text-[#ff8a3d]">KOREA GOLD PRICE</p>
                <h2 id="gold-title" className="mt-1 text-[20px] font-extrabold tracking-[-.04em]">국내 오늘의 금시세</h2>
              </div>
              <a href={gold?.sourceUrl || "https://www.koreagoldx.co.kr/price/gold"} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-white/15 px-2.5 text-[10px] font-bold text-white/70">
                한국금거래소 <span aria-hidden="true">↗</span>
              </a>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-white/45">
              <span>1돈 = 3.75g</span><span>·</span><span>내가 살 때 VAT 포함</span>
              {fetchedTime && <><span>·</span><span>{fetchedTime} 기준</span></>}
              {gold?.stale && <span className="rounded bg-amber-300/15 px-1.5 py-0.5 text-amber-200">이전 조회값</span>}
            </div>
          </div>

          <div className="px-3 py-3 sm:px-5">
            <div className="grid grid-cols-[1.05fr_.95fr_.95fr] items-end gap-2 border-b border-white/10 pb-2 text-[10px] font-bold text-white/50">
              <span>품목</span><span>내가 살 때</span><span>내가 팔 때</span>
            </div>

            {goldLoading && !gold ? (
              <div className="space-y-3 py-4" aria-label="금시세 불러오는 중">
                {[0,1,2,3,4].map((n) => <div key={n} className="h-11 animate-pulse rounded-lg bg-white/[.06]" />)}
              </div>
            ) : gold ? (
              <div className="divide-y divide-white/[.08]">
                {gold.rows.map((row) => (
                  <div key={row.id} className="grid grid-cols-[1.05fr_.95fr_.95fr] items-center gap-2 py-3">
                    <div className="min-w-0">
                      <strong className="block text-[14px] font-extrabold leading-tight sm:text-[15px]">{row.name}</strong>
                      <span className="mt-1 block truncate text-[9px] text-white/40">{row.sub}</span>
                    </div>
                    <div className="min-w-0">
                      {row.buy != null ? (
                        <>
                          <div className="whitespace-nowrap text-[clamp(14px,4vw,20px)] font-extrabold leading-none tracking-[-.04em]">{won(row.buy)}<span className="ml-0.5 text-[9px] font-medium text-white/50">원</span></div>
                          <Delta value={row.buyChange} pct={row.buyPct} />
                        </>
                      ) : (
                        <span className="block text-[11px] font-bold leading-snug text-white/70">{row.buyLabel || "제품시세적용"}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="whitespace-nowrap text-[clamp(14px,4vw,20px)] font-extrabold leading-none tracking-[-.04em]">{won(row.sell)}<span className="ml-0.5 text-[9px] font-medium text-white/50">원</span></div>
                      <Delta value={row.sellChange} pct={row.sellPct} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <p className="text-[13px] font-bold">국내 시세를 불러오지 못했어요.</p>
                <p className="mt-1 text-[11px] text-white/45">잘못된 가격을 대신 표시하지 않습니다. 잠시 후 다시 확인해 주세요.</p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-white/[.03] px-4 py-3 sm:px-5">
            <p className="text-[9px] leading-relaxed text-white/40">
              {goldError && gold ? "새 시세 갱신에 실패해 마지막 정상 조회값을 표시 중 · " : ""}
              한국금거래소 공개 시세 기준 · 실제 매입가는 제품 상태와 거래 조건에 따라 달라질 수 있어요.
            </p>
            <Link href={createLink("오늘 국내 금시세를 고객에게 쉽게 설명하는 당근 소식")} className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-[#d9480f] px-3 text-[11px] font-extrabold text-white">
              오늘 시세로 소식 만들기 <Icon name="arrow" size={14} />
            </Link>
          </div>
        </section>

        <section aria-labelledby="work-title" aria-busy={!loaded}>
          <div className="section-heading"><h2 id="work-title">내 콘텐츠 현황</h2><span className="muted-text">저장한 글 기준</span></div>
          <div className="work-grid">
            <Link href="/library?status=review" className="work-card"><span className="soft-icon orange"><Icon name="edit" /></span><span>검수할 소식<strong>{loaded ? stats.review : "–"}<small>건</small></strong></span><Icon name="chevron" size={16} /></Link>
            <Link href="/library?status=scheduled" className="work-card"><span className="soft-icon green"><Icon name="calendar" /></span><span>발행 예정<strong>{loaded ? stats.scheduled : "–"}<small>건</small></strong></span><Icon name="chevron" size={16} /></Link>
          </div>
          <div className="work-summary"><span>작성 중 <b>{loaded ? stats.drafts : "–"}</b>건</span><span>발행한 소식 <b>{loaded ? stats.published : "–"}</b>건</span><Link href="/library">모두 보기<Icon name="arrow" size={15} /></Link></div>
        </section>

        <PopularDaangn preview />

        <section aria-labelledby="recent-title" aria-busy={!loaded}>
          <div className="section-heading"><h2 id="recent-title">최근 작업한 소식</h2><Link href="/library" className="text-link">보관함<Icon name="arrow" size={16} /></Link></div>
          <div className="recent-list">
            {!loaded ? <p className="empty-note" role="status">저장한 소식을 불러오는 중이에요.</p> : recent.length ? recent.map((item) => <Link key={item.id} href={`/library?q=${encodeURIComponent(item.title)}`} className="recent-item"><span className="recent-icon"><Icon name="folder" size={19} /></span><span className="recent-content"><strong>{item.title}</strong><span>{item.createdAt} · {item.type}</span></span><span className={`status-label ${item.status === "발행됨" ? "status-published" : ""}`}>{item.status}</span></Link>) : <div className="empty-state"><Icon name="folder" size={30} /><h3>첫 소식을 만들어 볼까요?</h3><p>작성한 글은 이곳에서 다시 찾을 수 있어요.</p><Link href="/create" className="text-link">소식 만들기<Icon name="arrow" size={16} /></Link></div>}
          </div>
        </section>

        <aside className="workflow-note"><Icon name="info" size={18} /><p>발행 예정은 일정 관리 표시예요. <strong>당근 게시 완료 여부는 직접 확인해 주세요.</strong></p></aside>
        <footer className="studio-footer">우리 가게의 이야기가 단골과 만나는 곳.<span>당근 Post AI</span></footer>
      </main>
    </div>
  );
}
