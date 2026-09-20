"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { useBrand, useContents } from "@/lib/store";
import {
  TrendVideo, VideoMetrics, analyzeTitle, analyzeComments, buildCarrotTitles, carrotTitleFrom,
  fmtNum, loadKeywords, recommendScore, saveKeywords, scoreVideo, CarrotTitle, CommentInsight, YTComment
} from "@/lib/trends";

type SortMode = "views" | "recent" | "engaged" | "rising";

const VIDEO_CACHE_KEY = "cpai_youtube_last_results_v1";

const KEYWORD_OPTIONS = ["금값", "금시세", "금매입", "순금", "24K", "18K", "14K", "돌반지", "금목걸이", "금반지", "금테크", "금값 상승", "금값 하락", "금 팔기", "금 살때", "오래된 금", "금 감정"];

const SORTS: { id: SortMode; label: string }[] = [
  { id: "views", label: "조회수 높은 순" },
  { id: "recent", label: "최근 업로드" },
  { id: "engaged", label: "반응 좋은 영상" },
  { id: "rising", label: "급상승 가능" }
];

function Thumb({ v }: { v: TrendVideo }) {
  const [err, setErr] = useState(false);
  const real = /^[A-Za-z0-9_-]{11}$/.test(v.videoId);
  if (real && !err) {
    return (
      <div className="trend-thumb">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`} alt="" className="w-full h-full object-cover" onError={() => setErr(true)} loading="lazy" />
        <span className="absolute bottom-1.5 right-1.5 text-[10px] font-bold bg-black/70 text-white rounded px-1.5 py-0.5">▶ YouTube</span>
      </div>
    );
  }
  return (
    <div className="trend-thumb trend-thumb-empty">
      <span className="text-[18px]">{real ? "영상" : "예시"}</span>
      <span className="text-white font-extrabold text-[13px] leading-tight mt-1 line-clamp-2">{v.keyword}</span>
      <span className="text-white/50 text-[10.5px] font-bold mt-1">{real ? "이미지 불러오기 실패" : "실제 영상 아님"}</span>
    </div>
  );
}

function ScoreBar({ label, value, hint }: { label: string; value: number; hint?: string }) {
  const color = value >= 75 ? "bg-emerald-500" : value >= 50 ? "bg-amber-500" : "bg-neutral-300";
  return (
    <div className="flex items-center gap-2 text-[11.5px]">
      <span className="w-[86px] font-bold text-neutral-500">{label} {hint && <span className="font-normal">· {hint}</span>}</span>
      <div className="flex-1 h-1.5 rounded-full bg-neutral-100 overflow-hidden"><div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} /></div>
      <span className="w-7 text-right font-black">{value}</span>
    </div>
  );
}

export default function TrendsPage() {
  const { brand } = useBrand();
  const { items } = useContents();
  const [keywords, setKeywords] = useState<string[]>(loadKeywords());
  const [customKeywords, setCustomKeywords] = useState<string[]>([]);
  const [newKw, setNewKw] = useState("");
  const [days, setDays] = useState(30);
  const [sort, setSort] = useState<SortMode>("views");
  const [videos, setVideos] = useState<TrendVideo[]>([]);
  const [demo, setDemo] = useState(true);
  const [showingSaved, setShowingSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [analyzedId, setAnalyzedId] = useState<string | null>(null);
  const [madeTitle, setMadeTitle] = useState<Record<string, { title: string; similarity: number }>>({});
  const [top10, setTop10] = useState<CarrotTitle[] | null>(null);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("cpai_youtube_top_titles_v1") || "null");
      if (Array.isArray(saved) && saved.length && saved.every(t => t && typeof t.title === "string" && typeof t.pattern === "string" && t.scores && [t.scores.recommend, t.scores.interest, t.scores.recency, t.scores.overlap].every(Number.isFinite))) setTop10(saved.slice(0, 10));
    } catch {}
  }, []);
  useEffect(() => {
    if (top10) try { localStorage.setItem("cpai_youtube_top_titles_v1", JSON.stringify(top10)); } catch {}
  }, [top10]);
  const [mixingComments, setMixingComments] = useState(false);
  const [cOpen, setCOpen] = useState<string | null>(null);
  const [cData, setCData] = useState<Record<string, { loading: boolean; insights?: CommentInsight[]; keywords?: { w: string; n: number }[]; comments?: YTComment[]; demo?: boolean; disabled?: boolean }>>({});
  const [toast, setToast] = useState("");
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(""), 1700); };
  const [gold, setGold] = useState<{ sell: number; date: string } | null>(null);

  useEffect(() => {
    fetch("/api/gold-price").then((r) => r.json()).then((j) => {
      const row = (j.rows ?? []).find((r: { id: string }) => r.id === "24k");
      if (row && typeof row.sell === "number") setGold({ sell: row.sell, date: String(j.priceDate ?? j.date ?? "").slice(0, 10) });
    }).catch(() => {});
  }, []);

  // 댓글 로드 + 분석 (영상별)
  const loadComments = async (m: VideoMetrics) => {
    if (cOpen === m.videoId) { setCOpen(null); return; }
    setCOpen(m.videoId);
    if (cData[m.videoId] && !cData[m.videoId].loading) return;
    setCData((p) => ({ ...p, [m.videoId]: { loading: true } }));
    try {
      const r = await fetch(`/api/youtube/comments?videoId=${m.videoId}`);
      const j = await r.json();
      if (j.disabled) { setCData((p) => ({ ...p, [m.videoId]: { loading: false, disabled: true } })); return; }
      const list = (j.comments ?? []) as YTComment[];
      const a = analyzeComments(list);
      const top = [...list].sort((x, y) => y.likes - x.likes).slice(0, 10);
      setCData((p) => ({ ...p, [m.videoId]: { loading: false, insights: a.insights, keywords: a.keywords, comments: top, demo: j.demo } }));
    } catch {
      setCData((p) => ({ ...p, [m.videoId]: { loading: false, insights: [], keywords: [], comments: [] } }));
    }
  };

  const fetchVideos = async (kws: string[], d: number, s: SortMode) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/youtube/search?keywords=${encodeURIComponent(kws.slice(0, 2).join(","))}&days=${d}&sort=${s}`);
      const j = await r.json();
      if (r.ok && j.demo === false && Array.isArray(j.videos) && j.videos.length) {
        setVideos(j.videos); setDemo(false); setShowingSaved(false);
        try { localStorage.setItem(VIDEO_CACHE_KEY, JSON.stringify(j.videos)); } catch {}
      } else {
        setShowingSaved(true);
        setVideos((previous) => previous.length ? previous : (j.videos ?? []));
      }
    } catch {
      setShowingSaved(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(VIDEO_CACHE_KEY) ?? "null");
      if (Array.isArray(saved) && saved.length && saved.every((v) => v && typeof v.videoId === "string" && /^[A-Za-z0-9_-]{11}$/.test(v.videoId) && typeof v.title === "string" && typeof v.url === "string")) {
        setVideos(saved); setDemo(false); setShowingSaved(true);
      }
    } catch {}
    fetchVideos(keywords, days, sort);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  const scored: VideoMetrics[] = useMemo(() => {
    const list = videos.map(scoreVideo);
    if (sort === "views") list.sort((a, b) => b.views - a.views);
    else if (sort === "recent") list.sort((a, b) => a.daysSince - b.daysSince);
    else if (sort === "engaged") list.sort((a, b) => (b.likes + b.comments * 5) / Math.max(1, b.views) - (a.likes + a.comments * 5) / Math.max(1, a.views));
    else list.sort((a, b) => b.interest - a.interest);
    return list;
  }, [videos, sort]);

  const addKw = () => {
    const k = newKw.trim();
    if (!k || keywords.includes(k)) return;
    if (keywords.length >= 2) { say("검색 키워드는 최대 2개입니다. 기존 키워드를 빼고 추가해 주세요."); return; }
    const next = [...keywords, k];
    setKeywords(next); saveKeywords(next); setCustomKeywords((p) => Array.from(new Set([...p, k]))); setNewKw("");
  };

  // 오늘 인기 제목 10개: 영상 패턴 7 + 댓글 질문 섞기
  const genTop10 = async () => {
    const base = buildCarrotTitles(videos, items, 7);
    setTop10(base);
    setMixingComments(true);
    try {
      const top5 = scored.slice(0, 5);
      const lists = await Promise.all(top5.map(async (m) => {
        try {
          const r = await fetch(`/api/youtube/comments?videoId=${m.videoId}`);
          const j = await r.json();
          if (j.disabled || !(j.comments ?? []).length) return [] as CarrotTitle[];
          return analyzeComments(j.comments).insights.slice(0, 2).map((ins) => ({
            title: ins.title, sourceVideoId: m.videoId, pattern: `댓글 · ${ins.topic}`,
            similarity: 0, scores: { interest: 75, recency: 85, overlap: 5, recommend: 82 }
          } as CarrotTitle));
        } catch { return [] as CarrotTitle[]; }
      }));
      const seen = new Set(base.map((t) => t.title));
      const merged = [...base];
      for (const ins of lists.flat()) {
        if (merged.length >= 10) break;
        if (seen.has(ins.title)) continue;
        seen.add(ins.title); merged.push(ins);
      }
      if (merged.length < 10) {
        for (const t of buildCarrotTitles(videos, items, 20)) {
          if (merged.length >= 10) break;
          if (seen.has(t.title)) continue;
          seen.add(t.title); merged.push(t);
        }
      }
      setTop10(merged.sort((a, b) => b.scores.recommend - a.scores.recommend));
      say("당근용 제목 10개 생성됨 (댓글 반영)");
    } finally {
      setMixingComments(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <Sidebar bizName={brand.businessName} extConnected={false} />
      <div className="flex-1 min-w-0">
        <Topbar title="유튜브 인기 콘텐츠 분석" sub="트렌드 센서 · 복제 금지" />
        <main className="max-w-[1060px] mx-auto px-4 lg:px-8 py-6 space-y-4">
          <div className="hidden lg:flex items-start justify-between">
            <div>
              <h1 className="text-[26px] font-black tracking-tight">🔥 유튜브 인기 콘텐츠 분석</h1>
              <p className="text-[13.5px] text-neutral-500 mt-1">인기 영상을 복사하지 않고, 지금 관심받는 <b>주제·제목 패턴</b>만 추출해 당근용으로 재가공합니다.</p>
            </div>
            {demo && <span className="text-[11.5px] font-bold text-neutral-500 bg-neutral-100 border border-neutral-200 rounded-full px-3 py-1.5">실제 영상 검색 결과가 없어 예시를 표시합니다. 예시에는 썸네일이 없습니다.</span>}
          </div>

          {showingSaved && !demo && <p role="status" className="text-[13px] text-neutral-600">새 검색 결과를 가져오지 못해 마지막으로 불러온 영상을 표시합니다. 썸네일과 영상 링크는 계속 이용할 수 있습니다.</p>}

          {/* 오늘 금 시세 (국내 기준) */}
          <section className="card p-5 flex flex-wrap items-center gap-x-5 gap-y-2">
            <div>
              <div className="label">오늘 금 시세 · 순금 1돈 팔때 기준{gold?.date ? ` (${gold.date})` : ""}</div>
              {gold ? (
                <div className="mt-1 flex items-baseline gap-2 flex-wrap">
                  <span className="text-[22px] font-black tracking-tight">{gold.sell.toLocaleString()}원</span>
                </div>
              ) : (
                <div className="mt-1 text-[14px] font-bold text-neutral-400">시세 불러오는 중…</div>
              )}
            </div>
            <Link href={{ pathname: "/create", query: { topic: gold ? `오늘 순금 1돈 ${gold.sell.toLocaleString()}원 기준 매도 타이밍 안내` : "오늘 금 시세 안내" } }} className="btn-primary px-5 py-2.5 text-[13px] font-bold ml-auto">이 시세로 글 만들기 ✦</Link>
          </section>

          {/* 검색 조건 */}
          <section className="card p-5 space-y-3.5">
            <div>
              <div className="label mb-2">검색 키워드 · 최대 2개 선택 · 다시 누르면 선택 해제</div>
              <div className="flex flex-wrap gap-1.5">
                {Array.from(new Set([...KEYWORD_OPTIONS, ...customKeywords, ...keywords])).map((k) => (
                  <button key={k} aria-pressed={keywords.includes(k)} onClick={() => {
                    if (!keywords.includes(k) && keywords.length >= 2) { say("최대 2개까지 선택할 수 있어요. 선택한 키워드를 해제해 주세요."); return; }
                    const next = keywords.includes(k) ? keywords.filter((x) => x !== k) : [...keywords, k];
                    setKeywords(next); saveKeywords(next);
                  }} className={`chip !text-[12.5px] ${keywords.includes(k) ? "active" : ""}`}>
                    #{k} {keywords.includes(k) && <span aria-hidden="true">✓</span>}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap sm:flex-nowrap gap-2">
                <input value={newKw} onChange={(e) => setNewKw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addKw()}
                  disabled={keywords.length >= 2} placeholder={keywords.length >= 2 ? "선택을 해제하면 추가할 수 있어요" : "키워드 추가 (예: 금은방)"} className="w-full sm:w-auto flex-1 sm:max-w-[260px] rounded-xl border border-neutral-200 px-3.5 py-2.5 text-[13px] outline-none focus:border-neutral-400" />
                <button onClick={addKw} disabled={keywords.length >= 2} className="btn-ghost flex-1 sm:flex-none px-4 py-2.5 text-[13px] font-bold">＋ 추가</button>
                <button onClick={() => fetchVideos(keywords, days, sort)} className="btn-primary flex-1 sm:flex-none px-5 py-2.5 text-[13px] font-bold">검색 실행</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              <div>
                <div className="label mb-1.5">수집 기간</div>
                <div className="flex gap-1.5">{[7, 30, 90].map((d) => (<button key={d} onClick={() => { setDays(d); fetchVideos(keywords, d, sort); }} className={`chip !text-[12.5px] ${days === d ? "active" : ""}`}>최근 {d}일</button>))}</div>
              </div>
              <div>
                <div className="label mb-1.5">정렬</div>
                <div className="flex gap-1.5 flex-wrap">{SORTS.map((s) => (<button key={s.id} onClick={() => setSort(s.id)} className={`chip !text-[12.5px] ${sort === s.id ? "active" : ""}`}>{s.label}</button>))}</div>
              </div>
            </div>
            <p className="text-[12px] text-neutral-400">※ 오래된 누적 조회수만 보지 않습니다. <b className="text-neutral-600">조회수 속도(조회수÷경과일) · 좋아요 비율 · 댓글 반응</b>으로 현재 관심도를 계산합니다.</p>
          </section>

          {/* 오늘 인기 제목 만들기 */}
          <section className="rounded-2xl p-5 text-white flex flex-col sm:flex-row sm:items-center gap-3" style={{ background: "#111" }}>
            <div className="flex-1">
              <div className="font-black text-[16px]">✦ 오늘 인기 제목 만들기</div>
              <div className="text-[12.5px] opacity-70">검색 → 반응 선별 → 패턴 분석 → 중복 제거 → 당근용 10개 생성</div>
            </div>
            <button onClick={genTop10} disabled={mixingComments}
              className="font-bold text-[13.5px] rounded-xl px-5 py-3 text-white shrink-0 disabled:opacity-60" style={{ background: "var(--brand)" }}>
              {mixingComments ? "댓글 반영 중…" : top10 ? "다시 생성" : "10개 생성하기"}
            </button>
          </section>

          {top10 && (
            <section className="card p-5 animate-pop">
              <h3 className="font-extrabold text-[15px]">당근용 새 제목 10선 <span className="text-[11.5px] font-semibold text-neutral-400">원본 복사 아님 · 패턴 재가공 · 유사도 60%↑ 자동 재생성됨</span></h3>
              <div className="mt-3 divide-y divide-neutral-100">
                {top10.map((t, i) => {
                  const source = scored.find(video => video.videoId === t.sourceVideoId);
                  return (
                  <div key={t.title} className="trend-title-result">
                    {source && <Thumb v={source} />}
                    <span className="w-7 h-7 rounded-lg bg-neutral-900 text-white text-[12px] font-black flex items-center justify-center shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-bold">{t.pattern.startsWith("댓글 ·") && <span className="mr-1 text-[10px] bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 align-middle">💬 댓글 질문</span>}“{t.title}”</div>
                      {source && <div className="trend-title-source">
                        <span>{source.channel}</span>
                        <strong>조회수 {source.views.toLocaleString("ko-KR")}회</strong>
                        <span>좋아요 {fmtNum(source.likes)} · 댓글 {source.comments.toLocaleString("ko-KR")}개</span>
                        <button type="button" className="btn-ghost" onClick={() => {
                          if (cOpen !== source.videoId) void loadComments(source);
                          document.getElementById(`video-${source.videoId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }}>💬 댓글 보기</button>
                      </div>}
                      <div className="text-[11.5px] text-neutral-400">패턴 {t.pattern} · 추천도 <b className="text-neutral-700">{t.scores.recommend}</b> (관심 {t.scores.interest} · 최신 {t.scores.recency} · 중복 {t.scores.overlap})</div>
                    </div>
                    <Link href={`/create?topic=${encodeURIComponent(t.title)}`} className="btn-primary text-[12px] px-3.5 py-2 font-bold shrink-0">소식 만들기 →</Link>
                  </div>
                ); })}
              </div>
              <p className="mt-2 text-[11.5px] text-neutral-400">※ 점수는 절대적 성과 예측이 아니라 <b>콘텐츠 아이디어 선별용 내부 지표</b>입니다.</p>
            </section>
          )}

          {/* 영상 리스트 */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-[15px]">{demo ? "주제 예시 목록" : "인기 영상 리스트"} <span className="text-neutral-400 text-[12px] font-semibold">{scored.length}건</span></h3>
              {loading && <span className="text-[12px] font-bold text-neutral-400 typing">수집 중</span>}
            </div>
            {scored.map((m) => {
              const p = analyzeTitle(m.title);
              const s = recommendScore(m, items);
              const made = madeTitle[m.videoId];
              const open = analyzedId === m.videoId;
              return (
                <article id={`video-${m.videoId}`} key={m.videoId} className="card trend-video-card" style={{scrollMarginTop:160}}>
                  <div className="trend-video-row">
                    <Thumb v={m} />
                    <div className="trend-video-copy">
                      <a href={demo ? `https://www.youtube.com/results?search_query=${encodeURIComponent(m.keyword)}` : m.url} target="_blank" rel="noreferrer" className="font-bold text-[14px] leading-snug hover:underline line-clamp-2">{m.title}</a>
                      <div className="mt-1 text-[12px] text-neutral-400">{m.channel} · {m.publishedAt} ({m.daysSince}일 전) · #{m.keyword}</div>
                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] font-semibold text-neutral-600">
                        <span>조회 {fmtNum(m.views)}</span><span>좋아요 {fmtNum(m.likes)}</span><span>댓글 {fmtNum(m.comments)}</span>
                        <span className="text-neutral-900">⚡ 속도 {fmtNum(m.viewVelocity)}/일</span>
                        <span className="font-black" style={{ color: "var(--brand)" }}>현재 관심도 {m.interest}</span>
                      </div>
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        <button onClick={() => setAnalyzedId(open ? null : m.videoId)} className="btn-ghost flex-1 sm:flex-none px-3 py-1.5 text-[12px] font-bold">{open ? "분석 닫기" : "이 제목 분석"}</button>
                        <button onClick={() => loadComments(m)} className="btn-ghost flex-1 sm:flex-none px-3 py-1.5 text-[12px] font-bold">{cOpen === m.videoId ? "댓글 닫기" : "💬 댓글 보기"}</button>
                        <button onClick={() => { const r = carrotTitleFrom(m); setMadeTitle({ ...madeTitle, [m.videoId]: { title: r.title, similarity: r.similarity } }); say("당근용 새 제목 생성됨 (원본과 다름)"); }} className="btn-ghost flex-1 sm:flex-none px-3 py-1.5 text-[12px] font-bold">당근 제목 만들기</button>
                        <Link href={`/create?topic=${encodeURIComponent((madeTitle[m.videoId]?.title ?? carrotTitleFrom(m).title))}`} className="w-full sm:w-auto text-center text-[12px] font-bold rounded-xl px-3.5 py-1.5 text-white" style={{ background: "var(--brand)" }}>이 주제로 소식 만들기 →</Link>
                      </div>
                    </div>
                  </div>

                  {made && (
                    <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-[13px] animate-pop">
                      <b>당근용 새 제목:</b> “{made.title}” <span className="text-[11.5px] text-neutral-500">(원본 유사도 {made.similarity}% · 그대로 복사하지 않음)</span>
                    </div>
                  )}

                  {cOpen === m.videoId && (() => {
                    const cd = cData[m.videoId];
                    return (
                      <div className="mt-3 rounded-xl bg-blue-50/60 border border-blue-200 p-4 animate-fadeUp">
                        <div className="text-[12.5px] font-black">💬 댓글 질문 분석 <span className="font-semibold text-neutral-400">— 시청자가 직접 묻는 것을 당근 주제로</span>
                          {cd?.demo && <span className="ml-1 text-[10.5px] font-bold text-neutral-500 bg-white border border-neutral-200 rounded-full px-2 py-0.5">데모 댓글</span>}
                        </div>
                        {!cd || cd.loading ? (
                          <div className="mt-2 text-[12.5px] font-bold text-neutral-400 typing">댓글 수집·분석 중</div>
                        ) : cd.disabled ? (
                          <div className="mt-2 text-[12.5px] text-neutral-500">이 영상은 댓글이 꺼져 있습니다.</div>
                        ) : (
                          <>
                            {(cd.keywords ?? []).length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {(cd.keywords ?? []).map((k) => (
                                  <span key={k.w} className="text-[11.5px] font-bold bg-white border border-blue-200 text-blue-800 rounded-full px-2.5 py-1">#{k.w} {k.n}</span>
                                ))}
                              </div>
                            )}
                            <div className="mt-2.5 space-y-2">
                              {(cd.insights ?? []).map((ins) => (
                                <div key={ins.topic + ins.title} className="rounded-xl bg-white border border-blue-100 px-3.5 py-2.5 flex items-center gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="text-[12px] font-black text-blue-700">{ins.topic} <span className="font-semibold text-neutral-400">· {ins.count}건 질문 · 👍 {ins.likes}</span></div>
                                    <div className="text-[13px] font-bold truncate mt-0.5">“{ins.title}”</div>
                                  </div>
                                  <Link href={`/create?topic=${encodeURIComponent(ins.title)}`} className="text-[11.5px] font-bold rounded-lg px-3 py-1.5 text-white shrink-0" style={{ background: "var(--brand)" }}>소식 만들기 →</Link>
                                </div>
                              ))}
                              {(cd.insights ?? []).length === 0 && (cd.comments ?? []).length === 0 && <div className="text-[12.5px] text-neutral-400">질문형 댓글이 없습니다.</div>}
                            </div>
                            {(cd.comments ?? []).length > 0 && (
                              <div className="mt-3">
                                <div className="text-[12px] font-black text-neutral-600">👍 좋아요 순 댓글 최대 10개</div>
                                <div className="mt-1.5 space-y-1.5">
                                  {(cd.comments ?? []).map((c, i) => (
                                    <div key={`${c.author}${i}`} className="rounded-xl bg-white border border-neutral-200 px-3.5 py-2.5">
                                      <div className="text-[11.5px] font-bold text-neutral-500">{i + 1}. {c.author} <span className="font-semibold">· 👍 {c.likes}</span></div>
                                      <div className="text-[13px] text-neutral-700 mt-0.5 leading-relaxed">{c.text.length > 120 ? c.text.slice(0, 120) + "…" : c.text}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })()}

                  {open && (
                    <div className="mt-3 rounded-xl bg-neutral-50 border border-neutral-200 p-4 animate-fadeUp">
                      <div className="text-[12.5px] font-black">AI 제목 패턴 분석 <span className="font-semibold text-neutral-400">— 문장 복사가 아닌 요소 분해</span></div>
                      <div className="mt-2 grid sm:grid-cols-2 gap-x-4 gap-y-1 text-[12.5px]">
                        <div>주제: <b>{p.topic}</b></div>
                        <div>핵심 키워드: <b>{p.keywords.join(", ")}</b></div>
                        <div>궁금증 유발: <b>{p.curiosity}</b></div>
                        <div>핵심 훅: <b>{p.hook}</b> · 고객 심리: <b>{p.psychology}</b></div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {[["질문형", p.isQuestion], ["숫자 사용", p.hasNumber], ["손해/주의형", p.isLossWarning], ["가격형", p.isPrice], ["비교형", p.isCompare], ["반전형", p.isTwist], ["타이밍형", p.isTiming]].map(([l, on]) => (
                          <span key={l as string} className={`text-[11.5px] font-bold rounded-full px-2.5 py-1 border ${on ? "bg-neutral-900 text-white border-neutral-900" : "bg-white text-neutral-400 border-neutral-200"}`}>{l}</span>
                        ))}
                      </div>
                      <div className="mt-3 space-y-1.5">
                        <ScoreBar label="유튜브 관심도" value={s.interest} />
                        <ScoreBar label="최근성" value={s.recency} />
                        <ScoreBar label="우리 중복도" value={s.overlap} hint="높을수록 우선순위↓" />
                        <ScoreBar label="추천도" value={s.recommend} />
                      </div>
                      <p className="mt-2 text-[11.5px] text-neutral-400">※ 점수는 절대적 성과 예측이 아니라 콘텐츠 아이디어 선별용 내부 지표입니다. 내부 발행 이력({items.length}건)과 함께 계산됩니다.</p>
                    </div>
                  )}
                </article>
              );
            })}
            {!loading && scored.length === 0 && <div className="card p-10 text-center text-neutral-400 text-[14px]">해당 기간에 수집된 영상이 없습니다. 기간을 90일로 넓혀보세요.</div>}
          </section>
        </main>
      </div>
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-neutral-900 text-white text-[13px] font-bold rounded-full px-5 py-2.5 animate-pop">{toast}</div>}
    </div>
  );
}
