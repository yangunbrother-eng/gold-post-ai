"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useBrand } from "@/lib/store";
import UiIcon, { type IconName } from "./UiIcon";

const MAIN: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "홈", icon: "home" },
  { href: "/trends", label: "주제 찾기", icon: "search" },
  { href: "/create", label: "소식 쓰기", icon: "plus" },
  { href: "/calendar", label: "일정", icon: "calendar" },
  { href: "/library", label: "보관함", icon: "library" },
];
const MORE: { href: string; label: string; desc: string; icon: IconName }[] = [
  { href: "/recommend", label: "추천 주제", desc: "어떤 글을 쓸지 막막할 때", icon: "spark" },
  { href: "/templates", label: "글 템플릿", desc: "자주 쓰는 글 형식", icon: "copy" },
  { href: "/create?section=images", label: "소식 이미지", desc: "글에 어울리는 이미지 만들기", icon: "image" },
  { href: "/history", label: "발행 이력", desc: "등록해 둔 발행 기록", icon: "clock" },
  { href: "/brand", label: "매장 정보", desc: "업체명 · 연락처 · 로고", icon: "shop" },
  { href: "/settings", label: "설정 및 연결", desc: "말투 · 지점 · 확장 프로그램", icon: "settings" },
];

export default function Topbar({ title, sub }: { title: string; sub?: string }) {
  const path = usePathname();
  const { brand, branches, activeBranchId, switchBranch } = useBrand();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const overflow = useRef<string | null>(null);
  const restoreScroll = () => {
    if (overflow.current !== null) document.body.style.overflow = overflow.current;
    overflow.current = null;
  };
  const close = () => { dialog.current?.close(); restoreScroll(); trigger.current?.focus(); };
  useEffect(() => { dialog.current?.close(); restoreScroll(); }, [path]);
  useEffect(() => () => restoreScroll(), []);
  const open = () => {
    overflow.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.showModal();
  };
  return <>
    <a href="#workspace-content" className="ws-skip">본문으로 바로가기</a>
    <header className="ws-topbar">
      <div className="ws-topbar-inner">
        <Link href="/" className="ws-brand" aria-label="당근 Post AI 홈">
          <span className="ws-brand-mark"><UiIcon name="spark" size={22} /></span>
          <span><strong>당근 Post <span className="ws-gold">AI</span></strong><small>{brand.businessName || "내 매장"}</small></span>
        </Link>
        <button ref={trigger} type="button" className="ws-icon-button" onClick={open} aria-label="전체 메뉴 및 매장 전환" aria-haspopup="dialog"><UiIcon name="menu" /></button>
      </div>
    </header>
    {path !== "/" && title && <div className="ws-page-heading"><h1>{title === "Dashboard" ? "홈" : title}</h1>{sub && <p>{sub}</p>}</div>}
    <span id="workspace-content" className="ws-anchor" tabIndex={-1} />
    <nav className="ws-bottom-nav" aria-label="주 메뉴">
      {MAIN.map((item) => {
        const active = path === item.href || (item.href === "/trends" && path === "/recommend");
        return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`ws-nav-item ${active ? "is-active" : ""} ${item.href === "/create" ? "ws-nav-create" : ""}`}>
          <span className="ws-nav-icon"><UiIcon name={item.icon} size={21} /></span><span>{item.label}</span>
        </Link>;
      })}
    </nav>
    <dialog ref={dialog} className="ws-menu-dialog" aria-labelledby="workspace-menu-title" onCancel={restoreScroll} onClose={restoreScroll} onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="ws-menu-content">
        <div className="ws-section-head"><h2 id="workspace-menu-title">전체 메뉴</h2><button type="button" className="ws-icon-button" aria-label="메뉴 닫기" onClick={close}><UiIcon name="close" /></button></div>
        <div className="ws-branch-card"><label htmlFor="workspace-branch">현재 매장</label><select id="workspace-branch" value={activeBranchId} onChange={(e) => switchBranch(e.target.value)}>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select><Link href="/brand" onClick={close}>매장 정보 수정 <UiIcon name="arrow" size={16} /></Link></div>
        <nav aria-label="추가 메뉴">{MORE.map((item) => <Link key={item.href} href={item.href} className="ws-menu-link" onClick={close}><span className="ws-tile-icon"><UiIcon name={item.icon} /></span><span><strong>{item.label}</strong><small>{item.desc}</small></span><UiIcon name="chevron" size={17} /></Link>)}</nav>
        <p className="ws-storage-note"><UiIcon name="info" size={16} />저장한 글과 설정은 이 브라우저에 보관돼요.</p>
      </div>
    </dialog>
  </>;
}
