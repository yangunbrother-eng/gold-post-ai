"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useBrand } from "@/lib/store";
import Icon, { type IconName } from "@/components/Icon";

const TABS: { href: string; label: string; icon: IconName; ariaLabel?: string }[] = [
  { href: "/", label: "홈", icon: "home" },
  { href: "/create", label: "소식 만들기", icon: "sparkles", ariaLabel: "소식 만들기" },
  { href: "/trends", label: "유튜브", icon: "youtube", ariaLabel: "유튜브에서 주제 찾기" },
  { href: "/library", label: "보관함", icon: "folder" },
  { href: "/ads", label: "광고 분석", icon: "trend" },
];
const MENUS: { href: string; label: string; desc: string; icon: IconName }[] = [
  { href: "/ads", label: "광고 분석", desc: "당근 광고 MCP · 광고비와 소재 성과 비교", icon: "trend" },
  { href: "/calendar", label: "캘린더", desc: "소식 발행 예정일 관리", icon: "calendar" },
  { href: "/recommend", label: "추천 주제", desc: "다음 글의 아이디어 찾기", icon: "sparkles" },
  { href: "/trends", label: "유튜브에서 주제 찾기", desc: "영상 검색 · 제목과 댓글 분석", icon: "youtube" },
  { href: "/create#images", label: "소식 이미지", desc: "작성한 글에 이미지 더하기", icon: "image" },
  { href: "/templates", label: "템플릿", desc: "자주 쓰는 글 형식", icon: "copy" },
  { href: "/history", label: "발행 이력", desc: "지난 소식 확인하기", icon: "clock" },
  { href: "/brand", label: "브랜드 설정", desc: "업체 정보와 안내 문구", icon: "store" },
  { href: "/settings", label: "설정", desc: "말투 · 지점 · 확장 프로그램", icon: "settings" },
];

export default function Topbar({ title, sub }: { title: string; sub?: string }) {
  const path = usePathname();
  const { brand, branches, activeBranchId, switchBranch } = useBrand();
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const isPrimary = TABS.some((tab) => tab.href === path);
  const close = () => setOpen(false);

  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (!open) { if (element.open) element.close(); return; }
    element.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      if (element.open) element.close();
      document.body.style.overflow = previous;
      trigger.current?.focus();
    };
  }, [open]);

  return (
    <>
      <a href="#main-content" className="skip-link" onClick={(event) => {
        const main = document.querySelector("main");
        if (main) { event.preventDefault(); main.setAttribute("tabindex", "-1"); main.focus(); main.scrollIntoView(); }
      }}>본문으로 바로 가기</a>
      <header className="app-header">
        <div className="shell header-row">
          <Link href="/" className="app-logo" aria-label="당근 Post AI 홈">
            <span className="logo-mark"><Icon name="carrot" size={23} /></span>
            <span>당근 Post <strong>AI</strong></span>
          </Link>
          <Link href="/brand" className="business-pill" title={brand.businessName}>
            <Icon name="store" size={15} /><span>{brand.businessName || "내 비즈니스"}</span>
          </Link>
        </div>
        <nav className="shell primary-nav" aria-label="주요 메뉴" style={{ gridTemplateColumns: `repeat(${TABS.length + 1}, minmax(0, 1fr))` }}>
          {TABS.map((tab) => (
            <Link key={tab.href} href={tab.href} className={`nav-item ${path === tab.href ? "is-active" : ""}`} aria-label={tab.ariaLabel || tab.label} aria-current={path === tab.href ? "page" : undefined}>
              <Icon name={tab.icon} size={20} /><span>{tab.label}</span>
            </Link>
          ))}
          <button ref={trigger} type="button" onClick={() => setOpen(true)} className={`nav-item ${!isPrimary || open ? "is-active" : ""}`} aria-label="전체 메뉴 열기" aria-expanded={open} aria-controls="all-menus" aria-haspopup="dialog">
            <Icon name="menu" size={20} /><span>전체 메뉴</span>
          </button>
        </nav>
      </header>
      {title && <div className="shell page-heading"><p className="eyebrow">나의 콘텐츠 스튜디오</p><h1>{title === "Dashboard" ? "오늘의 작업 공간" : title}</h1>{sub && <p className="page-subtitle">{sub}</p>}</div>}
      <dialog ref={dialog} id="all-menus" className="menu-dialog" aria-labelledby="menu-title" onCancel={close} onClose={close} onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
        <div className="menu-sheet">
          <div className="section-heading"><div><p className="eyebrow">나의 작업 도구</p><h2 id="menu-title">전체 메뉴</h2></div><button autoFocus type="button" onClick={close} className="icon-button" aria-label="전체 메뉴 닫기"><Icon name="close" /></button></div>
          <div className="branch-control"><label htmlFor="menu-branch">현재 사업장</label><select id="menu-branch" value={activeBranchId} onChange={(event) => switchBranch(event.target.value)}>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></div>
          <nav className="menu-list" aria-label="추가 메뉴">{MENUS.map((menu) => <Link key={menu.href} href={menu.href} onClick={close} className={`menu-link ${path === menu.href ? "is-active" : ""}`} aria-current={path === menu.href ? "page" : undefined}><span className="soft-icon"><Icon name={menu.icon} /></span><span className="menu-label"><strong>{menu.label}</strong><small>{menu.desc}</small></span><Icon name="chevron" size={16} /></Link>)}</nav>
          <p className="menu-note">복잡한 설정은 여기에서, 자주 하는 일은 상단 메뉴에서.</p>
        </div>
      </dialog>
    </>
  );
}
