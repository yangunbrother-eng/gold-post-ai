"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import snapshot from "@/lib/daangn-snapshot.json";
import { mergeDaangnPosts, type DaangnPost as Post } from "@/lib/daangn-posts";
export default function PopularDaangn({ preview = false }: { preview?: boolean }) {
  const [posts, setPosts] = useState<Post[]>(() => snapshot.map(p => ({ ...p, saved: true })).sort((a,b) => b.views-a.views));
  const [collecting, setCollecting] = useState(true);
  const [collectionMessage, setCollectionMessage] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    try {
      const saved = JSON.parse(localStorage.getItem("cpai_daangn_posts_v1") || "null");
      setPosts(previous => mergeDaangnPosts(previous, saved));
    } catch {}
    fetch("/api/daangn/popular", { signal: controller.signal })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => { if (!controller.signal.aborted) setPosts(previous => mergeDaangnPosts(previous, data.posts)); })
      .catch(() => {})
      .finally(() => { if (!controller.signal.aborted) setCollecting(false); });
    return () => controller.abort();
  }, []);
  const [search, setSearch] = useState("");
  const [days, setDays] = useState(0);
  const [sortBy, setSortBy] = useState<"views" | "date">("views");
  const [order, setOrder] = useState<"desc" | "asc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const collect = async () => {
    setCollecting(true); setCollectionMessage("등록된 업체의 최신 소식을 수집하고 있습니다…");
    try {
      let offset: number | null = 0;
      let total = 0;
      let sources = 0;
      let merged = posts;
      while (offset !== null) {
        const response: Response = await fetch(`/api/daangn/popular?refresh=1&offset=${offset}`, {cache:"no-store", signal: AbortSignal.timeout(55000)});
        if (!response.ok) throw new Error("수집 실패");
        const data: {posts: Post[]; collectedCount: number; sourceCount: number; totalSources: number; nextOffset: number | null} = await response.json();
        if (!Array.isArray(data.posts)) throw new Error("잘못된 응답");
        merged = mergeDaangnPosts(merged, data.posts);
        total += data.collectedCount;
        sources += data.sourceCount;
        setPosts(merged);
        try { localStorage.setItem("cpai_daangn_posts_v1", JSON.stringify(merged)); } catch {}
        setCollectionMessage(`금 관련 업체 ${sources}/${data.totalSources}곳 확인 중 · 소식 ${total}개 수집`);
        offset = data.nextOffset;
      }
      setPage(1);
      setCollectionMessage(total ? `금 관련 업체 ${sources}곳 확인 완료 · 소식 ${total}개 갱신` : "새 데이터를 가져오지 못했습니다. 기존 목록을 유지합니다.");
    } catch { setCollectionMessage("수집에 실패했습니다. 기존 목록을 유지합니다. 잠시 후 다시 시도해 주세요."); }
    finally { setCollecting(false); }
  };
  const filtered = useMemo(() => posts.filter(p => (!days || Date.parse(p.createdAt) >= Date.now() - days * 86400000) && (!search.trim() || `${p.shop} ${p.title}`.replace(/\s/g, "").includes(search.trim().replace(/\s/g, "")))), [posts, days, search]);
  const sorted = useMemo(() => [...filtered].sort((a,b) => {
    const difference = sortBy === "views" ? b.views-a.views : Date.parse(b.createdAt)-Date.parse(a.createdAt);
    return order === "desc" ? difference : -difference;
  }), [filtered, sortBy, order]);
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageNumbers = Array.from(new Set([1, currentPage-1, currentPage, currentPage+1, pageCount])).filter(n => n >= 1 && n <= pageCount).sort((a,b) => a-b);
  const pagination: (number | string)[] = [];
  pageNumbers.forEach((n,i) => {
    const previous = pageNumbers[i-1];
    if (i > 0 && n-previous === 2) pagination.push(previous+1);
    else if (i > 0 && n-previous > 2) pagination.push(`gap-${n}`);
    pagination.push(n);
  });
  const shops = new Set<string>();
  const uniqueShops = preview ? sorted.filter(post => !shops.has(post.shop) && !!shops.add(post.shop)) : [];
  const visible = preview ? uniqueShops.slice(0,3) : sorted.slice((currentPage-1)*pageSize, currentPage*pageSize);
  return <section aria-labelledby="ideas-title">
    <div className="section-heading"><div><h2 id="ideas-title">당근 인기 소식</h2><p className="section-description">금 관련 소식 · {days ? `최근 ${days}일` : "전체 기간"} · {filtered.length}개</p></div></div>
    {!preview && <div className="daangn-collect">
      <button className="daangn-collect-button" type="button" disabled={collecting} aria-busy={collecting} onClick={collect}><span className="daangn-collect-icon">{collecting ? <span className="daangn-collect-spinner" /> : <Icon name="carrot" size={26} />}</span><span className="daangn-collect-label"><strong>{collecting ? "소식을 모으고 있어요" : "소식 수집하기"}</strong><small>{collecting ? "잠시만 기다려 주세요" : "금 관련 업체의 최신 소식을 한곳에"}</small></span>{!collecting && <Icon name="arrow" size={20} />}</button>
      <p className="section-description">한국금거래소 등 금은방·금거래소·금 매입 업체의 공개 소식을 수집합니다.</p>
      {collectionMessage && <p role="status" className="section-description">{collectionMessage}</p>}
    </div>}
    {!preview && <div className="daangn-popular-sort" aria-label="업체 및 제목 검색">
      <input type="search" aria-label="업체명 또는 제목 검색" placeholder="업체명·제목 검색 (예: 금박사)" value={search} onChange={e => {setSearch(e.target.value); setPage(1);}} style={{flex:"1 1 200px", minWidth:0, padding:"11px 13px", border:"1px solid #ded8d0", borderRadius:10}} />
      <button aria-pressed={search === "금박사"} onClick={() => {setSearch("금박사"); setDays(0); setPage(1);}}>금박사만 보기</button>
    </div>}
    {!preview && <div className="daangn-popular-sort" aria-label="작성 기간">
      {[30,60,90,0].map(value => <button type="button" key={value} aria-pressed={days === value} onClick={() => {setDays(value); setPage(1);}}>{value ? `최근 ${value}일` : "전체"}</button>)}
    </div>}
    {!preview && <div className="daangn-popular-sort" aria-label="소식 정렬">
      <label>정렬 기준 <select aria-label="정렬 기준" value={sortBy} onChange={e => {setSortBy(e.target.value as "views" | "date"); setOrder("desc"); setPage(1);}}><option value="views">조회수</option><option value="date">작성일</option></select></label>
      <button type="button" aria-pressed={order === "desc"} onClick={() => { setOrder("desc"); setPage(1); }}>{sortBy === "views" ? "높은 순 ↓" : "최신순 ↓"}</button>
      <button type="button" aria-pressed={order === "asc"} onClick={() => { setOrder("asc"); setPage(1); }}>{sortBy === "views" ? "낮은 순 ↑" : "오래된 순 ↑"}</button>
      <label>페이지당 <select aria-label="페이지당 소식 개수" value={pageSize} onChange={e => {setPageSize(Number(e.target.value)); setPage(1);}}>{[10,20,30].map(n => <option key={n} value={n}>{n}개씩</option>)}</select></label>
    </div>}
    {!filtered.length && <p className="empty-note" role="status">검색 조건에 맞는 소식이 없습니다. 검색어나 기간을 변경해 주세요.</p>}
    <div className="daangn-popular-list">{visible.map((p,index) => <article className="daangn-popular-card" key={p.url}>
      <a href={p.url} target="_blank" rel="noopener noreferrer" className="daangn-popular-photo" aria-label={`${p.title} 원문 보기`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.thumbnail} alt="" width={84} height={84} decoding="async" loading="lazy" onError={e => { e.currentTarget.style.display = "none"; }} /><span>{(preview ? 0 : (currentPage-1)*pageSize)+index+1}</span>
      </a>
      <div className="daangn-popular-copy"><small>{p.shop} · 작성일 {p.createdAt?.slice(0,10)}</small><a href={p.url} target="_blank" rel="noopener noreferrer"><strong>{p.title}</strong></a>
        <div className="daangn-view-count">조회수 <b>{p.views.toLocaleString("ko-KR")}</b>회</div>
        <p>관심 {p.interest.toLocaleString()} · 댓글 {p.comments}</p>
        <small>{new Date(p.checkedAt).toLocaleDateString("ko-KR", {timeZone:"Asia/Seoul"})} 확인{p.saved ? " · 저장된 결과" : ""}</small>
        <Link className="daangn-popular-create" href={`/create?topic=${encodeURIComponent(p.title)}`}>이 주제로 소식 만들기 →</Link>
      </div>
    </article>)}</div>
    {preview ? <Link href="/daangn" className="daangn-popular-create">당근 인기 소식 전체 보기 →</Link> : <nav className="daangn-pagination" aria-label="소식 페이지">
      <button disabled={currentPage === 1} onClick={() => setPage(currentPage-1)}>이전</button>
      {pagination.map(value => typeof value === "number" ? <button key={value} aria-label={`${value}페이지`} aria-current={currentPage === value ? "page" : undefined} onClick={() => setPage(value)}>{value}</button> : <span key={value} className="daangn-page-gap" aria-hidden="true">…</span>)}
      <button disabled={currentPage === pageCount} onClick={() => setPage(currentPage+1)}>다음</button>
    </nav>}
    <p className="section-description">누적 조회수에는 광고 유입이 포함될 수 있어요. 당근 전체 순위는 아니며, 원문은 주제 참고용으로 활용해 주세요.</p>
  </section>;
}
