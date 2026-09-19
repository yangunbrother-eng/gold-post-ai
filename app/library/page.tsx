"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Topbar from "@/components/Topbar";
import Icon from "@/components/Icon";
import { useContents } from "@/lib/store";
import type { ContentItem } from "@/lib/types";

const FILTERS = [
  { id: "all", label: "전체", statuses: [] },
  { id: "draft", label: "작성 중", statuses: ["초안", "작성 필요"] },
  { id: "review", label: "검수 대기", statuses: ["AI 작성 완료"] },
  { id: "scheduled", label: "발행 예정", statuses: ["발행 예정"] },
  { id: "published", label: "발행됨", statuses: ["발행됨"] },
  { id: "archived", label: "보관", statuses: ["보관"] },
];
const TYPES = ["시세", "고객 후기", "실제 사례", "상품 소개", "FAQ", "이벤트", "영업 안내", "방문 안내", "정보성", "후기형", "문의 유도형", "자유 주제"];

function LibraryInner() {
  const params = useSearchParams();
  const initialQuery = params.get("q") ?? "";
  const initialStatus = params.get("status") ?? "all";
  const { items, loaded, remove, upsert } = useContents();
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState(initialStatus);
  const [type, setType] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => { setQuery(initialQuery); setStatus(FILTERS.some((filter) => filter.id === initialStatus) ? initialStatus : "all"); }, [initialQuery, initialStatus]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(""), 3200); return () => clearTimeout(timer); }, [notice]);
  const list = useMemo(() => {
    const selected = FILTERS.find((filter) => filter.id === status) ?? FILTERS[0];
    const needle = query.trim().toLocaleLowerCase("ko-KR");
    return items.filter((item) => (!needle || `${item.title} ${item.body}`.toLocaleLowerCase("ko-KR").includes(needle)) && (!type || item.type === type) && (!selected.statuses.length || selected.statuses.includes(item.status))).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [items, query, status, type]);
  const reset = () => { setQuery(""); setType(""); setStatus("all"); };
  const copy = async (item: ContentItem) => {
    try { await navigator.clipboard.writeText(`${item.title}\n\n${item.body}`); setNotice("제목과 본문을 복사했어요."); }
    catch { setNotice("복사 권한을 확인하거나 내용을 펼쳐 직접 복사해 주세요."); }
  };
  const archive = (item: ContentItem) => {
    const next = item.status === "보관" ? "초안" : "보관";
    setNotice(upsert({ ...item, status: next }) ? next === "보관" ? "보관 처리했어요. ‘보관’ 필터에서 확인하세요." : "작성 중 목록으로 옮겼어요." : "저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.");
  };
  const deleteItem = (item: ContentItem) => {
    if (window.confirm(`‘${item.title}’ 소식을 삭제할까요?\n이 작업은 되돌릴 수 없어요.`)) setNotice(remove(item.id) ? "소식을 삭제했어요." : "삭제하지 못했어요. 브라우저 저장 공간을 확인해 주세요.");
  };

  return <div className="app-root"><Topbar title="콘텐츠 보관함" sub="작성한 글을 찾고, 이어 쓰고, 다음 소식으로 활용하세요." /><main id="main-content" className="studio-main library-main" tabIndex={-1} aria-busy={!loaded}>
    <section className="library-search" aria-label="소식 검색과 필터">
      <div className="search-field"><Icon name="search" size={21} /><label htmlFor="content-search" className="sr-only">제목 또는 본문 검색</label><input id="content-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="어떤 소식을 찾으세요?" />{query && <button type="button" onClick={() => setQuery("")} className="icon-button" aria-label="검색어 지우기"><Icon name="close" size={18} /></button>}</div>
      <div className="filter-tabs" aria-label="콘텐츠 상태">{FILTERS.map((filter) => <button key={filter.id} type="button" aria-pressed={status === filter.id} onClick={() => setStatus(filter.id)} className={status === filter.id ? "is-active" : ""}>{filter.label}</button>)}</div>
      <div className="filter-bottom"><p role="status">{loaded ? <><strong>{list.length}</strong>개의 소식</> : "불러오는 중…"}</p><label className="sr-only" htmlFor="content-type">콘텐츠 유형</label><select id="content-type" value={type} onChange={(event) => setType(event.target.value)}><option value="">모든 유형</option>{TYPES.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
    </section>
    <div className="library-list">{!loaded ? <div className="empty-state" role="status"><Icon name="folder" size={30} /><p>저장한 소식을 불러오고 있어요.</p></div> : list.length ? list.map((item) => <article key={item.id} className="content-card">
      <div className="content-meta"><span>{item.type}</span><span className={`status-label ${item.status === "발행됨" ? "status-published" : ""}`}>{item.status}</span></div>
      <h2>{item.title}</h2><p className="body-excerpt">{item.body || "아직 본문이 없는 소식이에요."}</p>
      <div className="content-date"><span>{item.createdAt}</span>{item.sourceUrl && /^https?:\/\//i.test(item.sourceUrl) && <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">당근 원문 보기 ↗</a>}</div>
      <details className="content-details"><summary>내용 펼쳐보기</summary><p>{item.body}</p>{item.publishNote && <small>{item.publishNote}</small>}</details>
      <div className="content-actions"><Link href={`/create?id=${encodeURIComponent(item.id)}`} className="reuse-action editor-link"><Icon name="edit" size={16} />이어서 수정</Link><Link href={`/create?reuse=${encodeURIComponent(item.id)}`} className="editor-link"><Icon name="sparkles" size={16} />복사해 쓰기</Link><button type="button" onClick={() => void copy(item)} aria-label={`${item.title} 제목과 본문 복사`}><Icon name="copy" size={16} />글 복사</button><button type="button" onClick={() => archive(item)} aria-label={`${item.title} ${item.status === "보관" ? "꺼내기" : "보관"}`}><Icon name="archive" size={16} />{item.status === "보관" ? "꺼내기" : "보관"}</button><button type="button" className="delete-action" onClick={() => deleteItem(item)} aria-label={`${item.title} 삭제`}><Icon name="trash" size={17} /></button></div>
    </article>) : <div className="empty-state"><Icon name="search" size={32} /><h2>{items.length ? "조건에 맞는 소식이 없어요" : "아직 저장한 소식이 없어요"}</h2><p>{items.length ? "검색어나 필터를 바꿔 다시 찾아보세요." : "새 소식을 만들면 이곳에서 관리할 수 있어요."}</p>{items.length ? <button type="button" onClick={reset} className="btn-ghost">검색 조건 초기화</button> : <Link href="/create" className="btn-primary">첫 소식 만들기</Link>}</div>}</div>
    <aside className="workflow-note"><Icon name="info" size={18} /><p>저장된 콘텐츠는 현재 브라우저에 보관돼요. 다른 기기와 자동으로 동기화되지 않아요.</p></aside>
    {notice && <div className="feedback-toast" role="status">{notice}<button type="button" onClick={() => setNotice("")} aria-label="알림 닫기"><Icon name="close" size={16} /></button></div>}
  </main></div>;
}
export default function Library() { return <Suspense fallback={<div className="app-root"><Topbar title="콘텐츠 보관함" /><main className="studio-main"><p role="status">소식을 불러오는 중이에요.</p></main></div>}><LibraryInner /></Suspense>; }
