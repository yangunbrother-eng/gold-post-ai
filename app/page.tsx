"use client";
import Link from "next/link";
import { useMemo } from "react";
import Topbar from "@/components/Topbar";
import Icon, { type IconName } from "@/components/Icon";
import { useBrand, useContents, todayStr } from "@/lib/store";

const TOPICS: { name: string; icon: IconName; topic: string }[] = [
  { name: "오늘의 시세", icon: "trend", topic: "오늘의 금 시세 안내. 실제 확인한 가격과 기준 시간을 입력한 뒤 게시할 글" },
  { name: "고객 후기", icon: "message", topic: "실제 고객 후기를 소개하는 글. 고객이 남긴 원문만 바탕으로 작성" },
  { name: "영업 안내", icon: "store", topic: "우리 가게 영업시간과 방문 전 안내" },
  { name: "자주 묻는 질문", icon: "info", topic: "금 매입을 처음 알아보는 고객이 자주 묻는 질문" },
];
const IDEAS: { tag: string; title: string; description: string; icon: IconName }[] = [
  { tag: "질문에 답하기", title: "작은 금 조각도 팔 수 있나요?", description: "처음 문의하는 고객의 궁금증을 풀어주세요.", icon: "message" },
  { tag: "방문 안내", title: "가게에 오기 전, 이것만 확인하세요", description: "영업시간과 위치를 한 편의 소식으로 정리해요.", icon: "pin" },
  { tag: "가게 이야기", title: "우리 가게만의 상담 과정을 소개해요", description: "실제 서비스 과정을 알려 신뢰를 쌓아보세요.", icon: "store" },
];
const createLink = (topic: string) => `/create?topic=${encodeURIComponent(topic)}`;

export default function Dashboard() {
  const { items, loaded } = useContents();
  const { brand } = useBrand();
  const today = todayStr();
  const stats = useMemo(() => ({
    review: items.filter((item) => item.status === "AI 작성 완료").length,
    scheduled: items.filter((item) => item.status === "발행 예정").length,
    drafts: items.filter((item) => item.status === "초안" || item.status === "작성 필요").length,
    published: items.filter((item) => item.status === "발행됨").length,
  }), [items]);
  const recent = useMemo(() => [...items].filter((item) => item.status !== "보관").sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3), [items]);

  return (
    <div className="app-root">
      <Topbar title="" />
      <main id="main-content" className="studio-main" tabIndex={-1}>
        <section className="welcome-heading"><p className="eyebrow">{today.replaceAll("-", ".")} · 오늘의 작업 공간</p><h1>오늘도, 반가운 소식 하나.</h1><p>{brand.businessName}의 이야기를 더 쉽게 전해보세요.</p></section>

        <section className="compose-card" aria-labelledby="compose-title">
          <div className="compose-top"><span className="compose-label"><Icon name="sparkles" size={15} /> 소식 작성 도우미</span><span className="step-label">주제 → 작성 → 게시 준비</span></div>
          <h2 id="compose-title">무슨 글을 쓸지 고민될 때,<br />주제만 골라 시작하세요.</h2>
          <p>글 작성부터 이미지와 게시 준비까지 한곳에서.</p>
          <Link href="/create" className="primary-action"><Icon name="edit" />새 소식 만들기<Icon name="arrow" size={19} /></Link>
          <div className="mt-5" role="group" aria-labelledby="home-topic-title">
            <h3 id="home-topic-title" className="text-[13px] font-bold text-neutral-600">주제 선택</h3>
            <div className="quick-topics" aria-label="빠른 주제 선택">{TOPICS.map((topic) => <Link key={topic.name} href={createLink(topic.topic)}><Icon name={topic.icon} size={16} /><span>{topic.name}</span></Link>)}</div>
            <Link href="/trends" className="btn-ghost mt-3 flex w-full items-center justify-center gap-2 px-3 py-3 text-[14px] font-bold"><Icon name="youtube" />유튜브에서 주제 찾기<Icon name="arrow" size={17} /></Link>
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

        <section aria-labelledby="ideas-title"><div className="section-heading"><div><h2 id="ideas-title">이 주제로 시작해 보세요</h2><p className="section-description">가게 소식에 활용하기 좋은 기본 아이디어예요.</p></div></div><div className="ideas-list">{IDEAS.map((idea, index) => <Link className="idea-card" key={idea.title} href={createLink(idea.title)}><span className={`soft-icon idea-icon tone-${index}`}><Icon name={idea.icon} size={23} /></span><span className="idea-content"><small>{idea.tag}</small><strong>{idea.title}</strong><span>{idea.description}</span></span><Icon name="chevron" size={18} /></Link>)}</div><Link href="/recommend" className="quiet-link">다른 추천 주제 보기<Icon name="arrow" size={16} /></Link></section>

        <section aria-labelledby="recent-title" aria-busy={!loaded}><div className="section-heading"><h2 id="recent-title">최근 작업한 소식</h2><Link href="/library" className="text-link">보관함<Icon name="arrow" size={16} /></Link></div><div className="recent-list">{!loaded ? <p className="empty-note" role="status">저장한 소식을 불러오는 중이에요.</p> : recent.length ? recent.map((item) => <Link key={item.id} href={`/library?q=${encodeURIComponent(item.title)}`} className="recent-item"><span className="recent-icon"><Icon name="folder" size={19} /></span><span className="recent-content"><strong>{item.title}</strong><span>{item.createdAt} · {item.type}</span></span><span className={`status-label ${item.status === "발행됨" ? "status-published" : ""}`}>{item.status}</span></Link>) : <div className="empty-state"><Icon name="folder" size={30} /><h3>첫 소식을 만들어 볼까요?</h3><p>작성한 글은 이곳에서 다시 찾을 수 있어요.</p><Link href="/create" className="text-link">소식 만들기<Icon name="arrow" size={16} /></Link></div>}</div></section>
        <aside className="workflow-note"><Icon name="info" size={18} /><p>발행 예정은 일정 관리 표시예요. <strong>당근 게시 완료 여부는 직접 확인해 주세요.</strong></p></aside>
        <footer className="studio-footer">우리 가게의 이야기가 단골과 만나는 곳.<span>당근 Post AI</span></footer>
      </main>
    </div>
  );
}
