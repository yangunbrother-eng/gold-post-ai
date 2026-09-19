"use client";
import Link from "next/link";
import { useMemo } from "react";
import Topbar from "@/components/Topbar";
import UiIcon, { type IconName } from "@/components/UiIcon";
import { StatusBadge } from "@/components/PhonePreview";
import { useBrand, useContents, todayStr } from "@/lib/store";

const TOPICS: { label: string; desc: string; topic: string; icon: IconName }[] = [
  { label: "오늘의 시세", desc: "확인한 시세를 쉽게 알려요", topic: "오늘 확인한 금 매입 시세를 안내하는 글. 확인하지 않은 금액은 만들어 쓰지 말고 입력할 자리로 남겨줘.", icon: "spark" },
  { label: "고객이 자주 묻는 질문", desc: "방문 전 궁금증을 풀어줘요", topic: "금 매입 상담 전 고객이 준비할 것과 자주 묻는 질문을 안내해줘.", icon: "info" },
  { label: "매장 방문 안내", desc: "위치와 연락 방법을 알려요", topic: "우리 매장에 처음 방문하는 고객을 위한 위치와 연락 방법 안내", icon: "shop" },
  { label: "매입 사례 소개", desc: "실제 사례를 소식으로 만들어요", topic: "실제 금 매입 사례를 소개하는 글. 고객 사연이나 거래 금액은 꾸미지 말고 내가 채울 자리로 남겨줘.", icon: "edit" },
];
export default function Dashboard() {
  const { items, loaded } = useContents();
  const { brand } = useBrand();
  const today = todayStr();
  const stats = useMemo(() => ({
    draft: items.filter((i) => ["초안", "작성 필요"].includes(i.status)).length,
    review: items.filter((i) => i.status === "AI 작성 완료").length,
    planned: items.filter((i) => i.status === "발행 예정").length,
  }), [items]);
  const recent = useMemo(() => [...items].filter((i) => i.status !== "보관").sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3), [items]);
  const pending = stats.draft + stats.review;
  return <div className="ws-app"><Topbar title="" />
    <main className="ws-main">
      <section className="ws-hero">
        <div className="ws-eyebrow"><span className="ws-live-dot" />우리 매장 소식 작업실 <span className="ws-date">{today.replaceAll("-", ".")}</span></div>
        <h1>오늘의 소식,<br /><span>가볍게 시작하세요.</span></h1>
        <p>{brand.businessName || "우리 매장"}의 이야기를<br />주제 찾기부터 발행 준비까지, 한곳에서.</p>
        <Link href="/create" className="ws-button ws-button-primary ws-button-wide"><UiIcon name="spark" />새 소식 작성하기<UiIcon name="arrow" /></Link>
        <div className="ws-hero-bottom"><span>주제 선택</span><UiIcon name="chevron" size={13} /><span>글·이미지 만들기</span><UiIcon name="chevron" size={13} /><span>확인 후 발행</span></div>
      </section>
      <section aria-label="콘텐츠 현황" className="ws-stats">
        {[
          { label: "작성 중", n: stats.draft, status: "초안", icon: "edit" as const },
          { label: "검수 대기", n: stats.review, status: "AI 작성 완료", icon: "check" as const },
          { label: "발행 예정", n: stats.planned, status: "발행 예정", icon: "calendar" as const },
        ].map((s) => <Link key={s.label} href={`/library?status=${encodeURIComponent(s.status)}`} className="ws-stat"><span><UiIcon name={s.icon} size={16} />{s.label}</span><strong>{loaded ? s.n : "—"}<small>건</small></strong></Link>)}
      </section>
      {loaded && pending > 0 && <Link className="ws-reminder" href={`/library?status=${encodeURIComponent(stats.review ? "AI 작성 완료" : "초안")}`}><span className="ws-tile-icon"><UiIcon name="clock" /></span><span><strong>이어서 마무리할 글이 {pending}개 있어요</strong><small>작성한 글을 확인하고 다음 단계로 넘어가세요.</small></span><UiIcon name="chevron" size={18} /></Link>}
      <section className="ws-section">
        <div className="ws-section-head"><div><div className="ws-eyebrow">무엇을 쓸지 고민될 때</div><h2>이런 소식은 어때요?</h2></div><Link href="/trends" className="ws-text-link">주제 찾기<UiIcon name="arrow" size={16} /></Link></div>
        <div className="ws-topic-grid">{TOPICS.map((t, i) => <Link key={t.label} href={`/create?topic=${encodeURIComponent(t.topic)}`} className={`ws-topic-card ws-topic-${i}`}><span className="ws-tile-icon"><UiIcon name={t.icon} size={23} /></span><strong>{t.label}</strong><p>{t.desc}</p><span className="ws-topic-action">이 주제로 쓰기<UiIcon name="arrow" size={16} /></span></Link>)}</div>
      </section>
      <section className="ws-section">
        <div className="ws-section-head"><div><div className="ws-eyebrow">내 콘텐츠</div><h2>최근 작성한 소식</h2></div><Link href="/library" className="ws-text-link">전체 보기<UiIcon name="arrow" size={16} /></Link></div>
        <div className="ws-panel ws-recent-list">{!loaded ? <p className="ws-empty" role="status">저장한 소식을 불러오고 있어요.</p> : recent.length ? recent.map((c) => <Link href={`/create?id=${encodeURIComponent(c.id)}`} key={c.id} className="ws-recent-item"><span className="ws-recent-icon"><UiIcon name={c.status === "발행됨" ? "check" : "edit"} /></span><span className="ws-recent-copy"><strong>{c.title || "제목 없는 소식"}</strong><small>{c.createdAt} · {c.type}</small><StatusBadge status={c.status} /></span><UiIcon name="chevron" size={18} /></Link>) : <div className="ws-empty"><UiIcon name="edit" size={30} /><h3>첫 소식을 만들어 볼까요?</h3><p>작성한 글은 이곳에서 다시 이어 쓸 수 있어요.</p><Link href="/create" className="ws-text-link">첫 소식 쓰기<UiIcon name="arrow" size={16} /></Link></div>}</div>
      </section>
      <Link href="/brand" className="ws-brand-hint"><UiIcon name="shop" /><span><strong>우리 매장답게 쓰려면</strong><small>연락처와 매장 소개를 먼저 확인해 주세요.</small></span><UiIcon name="arrow" size={18} /></Link>
      <p className="ws-storage-note"><UiIcon name="info" size={15} />작성한 글은 이 브라우저에 저장돼요. PC·모바일 간 자동 동기화는 아직 지원하지 않아요.</p>
    </main>
  </div>;
}
