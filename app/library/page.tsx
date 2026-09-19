"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { StatusBadge, TypeBadge } from "@/components/PhonePreview";
import { useBrand, useContents } from "@/lib/store";

const TYPE_FILTER = ["전체", "정보형", "후기형", "이벤트", "FAQ", "상품 소개", "영업 안내", "시세", "방문 유도"];
const STATUS_FILTER = ["전체", "초안", "완료", "발행됨", "보관"];

export default function Library() {
  const { brand } = useBrand();
  const { items, remove, save } = useContents();
  const [q, setQ] = useState("");
  const [type, setType] = useState("전체");
  const [status, setStatus] = useState("전체");

  const list = useMemo(() => items.filter((c) => {
    const okQ = !q || (c.title + c.body).includes(q);
    const okT = type === "전체" || c.type.includes(type.replace("형", "")) || (type === "정보형" && c.type === "정보성");
    const okS = status === "전체" || (status === "완료" ? ["AI 작성 완료", "검수 완료", "발행 예정"].includes(c.status) : c.status === status);
    return okQ && okT && okS;
  }), [items, q, type, status]);

  return (
    <div className="min-h-screen flex">
      <Sidebar bizName={brand.businessName} extConnected={false} />
      <div className="flex-1 min-w-0">
        <Topbar title="콘텐츠 보관함" sub={`${items.length}건 저장됨`} />
        <main className="max-w-[1000px] mx-auto px-4 lg:px-8 py-6 space-y-4">
          <div className="hidden lg:block"><h1 className="text-[26px] font-black tracking-tight">콘텐츠 보관함</h1></div>
          <div className="card p-4 space-y-3">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="검색 — 제목·본문에서 찾기" className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-[14px] outline-none focus:border-neutral-400" />
            <div className="flex flex-wrap gap-1.5">{TYPE_FILTER.map((t) => (<button key={t} onClick={() => setType(t)} className={`chip !text-[12px] ${type === t ? "active" : ""}`}>{t}</button>))}</div>
            <div className="flex flex-wrap gap-1.5">{STATUS_FILTER.map((t) => (<button key={t} onClick={() => setStatus(t)} className={`chip !text-[12px] ${status === t ? "active" : ""}`}>{t}</button>))}</div>
          </div>
          <div className="grid gap-2.5">
            {list.map((c) => (
              <div key={c.id} className="card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[14px] truncate">{c.title}</div>
                  <div className="mt-1 flex items-center gap-1.5 flex-wrap"><TypeBadge type={c.type} /><StatusBadge status={c.status} /><span className="text-[11.5px] text-neutral-400">{c.date}</span>
                    {c.sourceUrl && (<><span className="text-[11px] font-bold bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5">당근 실제 발행글</span><a href={c.sourceUrl} target="_blank" rel="noreferrer" className="text-[11.5px] font-bold text-neutral-500 underline">원문 보기 ↗</a></>)}
                    {c.publishNote && <span className="text-[11.5px] text-neutral-400">{c.publishNote}</span>}</div>
                </div>
                <div className="flex gap-1.5 shrink-0 w-full sm:w-auto">
                  <Link href={`/create?topic=${encodeURIComponent(c.title)}`} className="btn-ghost flex-1 sm:flex-none px-3 py-2 text-[12px] font-bold text-center">재활용</Link>
                  <button onClick={() => save(items.map((i) => i.id === c.id ? { ...i, status: "보관" as const } : i))} className="btn-ghost flex-1 sm:flex-none px-3 py-2 text-[12px] font-bold">보관</button>
                  <button onClick={() => remove(c.id)} className="btn-ghost flex-1 sm:flex-none px-3 py-2 text-[12px] font-bold text-red-500">삭제</button>
                </div>
              </div>
            ))}
            {list.length === 0 && <div className="card p-10 text-center text-neutral-400 text-[14px]">조건에 맞는 콘텐츠가 없습니다.</div>}
          </div>
        </main>
      </div>
    </div>
  );
}
