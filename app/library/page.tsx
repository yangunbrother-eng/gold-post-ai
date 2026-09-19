"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Topbar from "@/components/Topbar";
import UiIcon from "@/components/UiIcon";
import { StatusBadge } from "@/components/PhonePreview";
import { useContents } from "@/lib/store";

const FILTERS = ["전체", "초안", "AI 작성 완료", "검수 완료", "발행 예정", "발행됨", "보관"];
const LABELS: Record<string, string> = { "초안": "작성 중", "AI 작성 완료": "검수 대기" };
function LibraryInner() {
  const params = useSearchParams();
  const { items, remove, upsert, loaded } = useContents();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("전체");
  const [type, setType] = useState("전체");
  const [toast, setToast] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { const s = params.get("status"); setStatus(s && FILTERS.includes(s) ? s : "전체"); }, [params]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const say = (m: string) => { setToast(m); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setToast(""), 3500); };
  const matches = (s: string, actual: string) => s === "전체" || s === actual || (s === "초안" && actual === "작성 필요");
  const types = useMemo(() => Array.from(new Set(items.map((i) => i.type))), [items]);
  const list = useMemo(() => items.filter((c) => {
    const query = q.trim().toLocaleLowerCase();
    return (!query || `${c.title} ${c.body}`.toLocaleLowerCase().includes(query)) && matches(status, c.status) && (type === "전체" || c.type === type);
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [items, q, type, status]);
  return <div className="ws-app"><Topbar title="콘텐츠 보관함" sub="저장한 글을 찾고, 이어 쓰고, 다시 활용하세요." />
    <main className="ws-main">
      <section className="ws-panel ws-stack" aria-label="콘텐츠 검색 및 필터">
        <label className="ws-search"><span className="sr-only">제목과 본문 검색</span><UiIcon name="search" /><input type="search" value={q} onChange={(e) => setQ(e.target.value)} className="ws-input" placeholder="찾고 싶은 소식을 검색하세요" /></label>
        <div className="ws-filter-scroll" aria-label="작성 상태">{FILTERS.map((s) => <button type="button" key={s} className={`ws-chip ${status === s ? "is-active" : ""}`} aria-pressed={status === s} onClick={() => setStatus(s)}>{LABELS[s] ?? s} <span>{items.filter((c) => matches(s, c.status)).length}</span></button>)}</div>
        <div className="ws-section-head"><span role="status" className="ws-count">{loaded ? `총 ${list.length}개의 소식` : "불러오는 중…"}</span><label className="ws-secondary-actions"><span className="ws-count">유형</span><select value={type} onChange={(e) => setType(e.target.value)} className="ws-chip" aria-label="콘텐츠 유형"><option value="전체">전체 유형</option>{types.map((t) => <option key={t}>{t}</option>)}</select></label></div>
      </section>
      <div className="ws-stack">{!loaded ? <div className="ws-skeleton" role="status" aria-label="보관함 불러오는 중" /> : list.map((c) => <article className="ws-panel ws-article" key={c.id}>
        <div className="ws-article-meta"><StatusBadge status={c.status} /><span>{c.type}</span><span>·</span><time>{c.createdAt}</time></div>
        <h2><Link href={`/create?id=${encodeURIComponent(c.id)}`}>{c.title || "제목 없는 소식"}</Link></h2>
        <p className="ws-article-excerpt">{c.body || "본문을 이어서 작성해 주세요."}</p>
        {c.sourceUrl && <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="ws-text-link">당근 원문 보기<UiIcon name="external" size={14} /></a>}
        <div className="ws-article-actions">
          <Link href={`/create?id=${encodeURIComponent(c.id)}`} className="ws-button"><UiIcon name="edit" size={15} />이어서 수정</Link>
          <Link href={`/create?reuse=${encodeURIComponent(c.id)}`} className="ws-button"><UiIcon name="copy" size={15} />복사해 쓰기</Link>
          <button className="ws-button" type="button" onClick={() => { const next = c.status === "보관" ? "초안" : "보관"; say(upsert({ ...c, status: next }) ? next === "보관" ? "글을 보관했어요." : "작성 중 목록으로 옮겼어요." : "저장 공간을 확인해 주세요. 변경하지 못했어요."); }}>{c.status === "보관" ? "꺼내기" : "보관"}</button>
          <button type="button" className="ws-button ws-delete" aria-label={`${c.title} 삭제`} onClick={() => { if (window.confirm(`“${c.title || "제목 없는 소식"}”을 삭제할까요? 삭제한 글은 복구할 수 없어요.`)) say(remove(c.id) ? "소식을 삭제했어요." : "삭제하지 못했어요. 브라우저 저장 공간을 확인해 주세요."); }}><UiIcon name="trash" size={16} /></button>
        </div>
      </article>)}</div>
      {loaded && !list.length && <section className="ws-panel ws-empty"><UiIcon name="search" size={32} /><h3>{q || status !== "전체" || type !== "전체" ? "조건에 맞는 소식이 없어요" : "아직 저장한 소식이 없어요"}</h3><p>검색 조건을 바꾸거나 새 소식을 작성해 보세요.</p><div className="ws-secondary-actions"><button className="ws-button" onClick={() => { setQ(""); setStatus("전체"); setType("전체"); }}>필터 초기화</button><Link href="/create" className="ws-button ws-button-primary">새 소식 쓰기</Link></div></section>}
      <p className="ws-storage-note"><UiIcon name="info" size={16} />이 브라우저에 저장된 전체 매장 콘텐츠예요. 브라우저 데이터를 지우면 저장한 글도 사라질 수 있어요.</p>
    </main>{toast && <div className="ws-toast" role="status">{toast}</div>}
  </div>;
}
export default function Library() { return <Suspense fallback={<div className="ws-empty">보관함을 불러오는 중…</div>}><LibraryInner /></Suspense>; }
