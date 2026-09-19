"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { StatusBadge } from "@/components/PhonePreview";
import { useBrand, useContents } from "@/lib/store";

export default function CalendarPage() {
  const { brand } = useBrand();
  const { items, save } = useContents();
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [dragId, setDragId] = useState<string | null>(null);

  const cells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const startDay = first.getDay();
    const days = new Date(cursor.y, cursor.m + 1, 0).getDate();
    const arr: (string | null)[] = [...Array(startDay).fill(null)];
    for (let d = 1; d <= days; d++) arr.push(`${cursor.y}-${String(cursor.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [cursor]);

  const move = (id: string, date: string) => save(items.map((i) => (i.id === id ? { ...i, date } : i)));

  return (
    <div className="min-h-screen flex">
      <Sidebar bizName={brand.businessName} extConnected={false} />
      <div className="flex-1 min-w-0">
        <Topbar title="콘텐츠 캘린더" sub="드래그로 날짜 이동" />
        <main className="max-w-[1100px] mx-auto px-4 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center justify-between sm:justify-start gap-3">
              <h1 className="text-[20px] sm:text-[26px] font-black tracking-tight">{cursor.y}년 {cursor.m + 1}월</h1>
              <div className="flex items-center gap-1">
                <button onClick={() => setCursor({ y: cursor.m === 0 ? cursor.y - 1 : cursor.y, m: cursor.m === 0 ? 11 : cursor.m - 1 })} className="btn-ghost px-2.5 py-1.5 text-[12px] font-bold">← 이전</button>
                <button onClick={() => { const d = new Date(); setCursor({ y: d.getFullYear(), m: d.getMonth() }); }} className="btn-ghost px-2.5 py-1.5 text-[12px] font-bold">오늘</button>
                <button onClick={() => setCursor({ y: cursor.m === 11 ? cursor.y + 1 : cursor.y, m: cursor.m === 11 ? 0 : cursor.m + 1 })} className="btn-ghost px-2.5 py-1.5 text-[12px] font-bold">다음 →</button>
              </div>
            </div>
            <Link href="/create" className="btn-primary w-full sm:w-auto px-4 py-2.5 text-[13px] font-bold text-center">＋ 예약 콘텐츠 만들기</Link>
          </div>
          <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] sm:text-[11.5px] font-bold text-neutral-400">
            {["일", "월", "화", "수", "목", "금", "토"].map((d) => <div key={d} className="py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {cells.map((date, i) => (
              <div key={i} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (dragId && date) move(dragId, date); setDragId(null); }}
                className={`min-h-[72px] sm:min-h-[96px] lg:min-h-[118px] rounded-xl border p-1 sm:p-1.5 text-left transition ${date ? "bg-white border-neutral-200" : "bg-transparent border-transparent"}`}>
                {date && (
                  <>
                    <div className="text-[11.5px] font-bold text-neutral-500">{Number(date.slice(-2))}일</div>
                    <div className="mt-1 space-y-1">
                      {items.filter((c) => c.date === date).map((c) => (
                        <div key={c.id} draggable onDragStart={() => setDragId(c.id)}
                          className="rounded-lg bg-neutral-50 border border-neutral-200 px-1.5 py-1 cursor-grab active:cursor-grabbing">
                          <div className="text-[11px] font-bold truncate leading-tight">{c.title}</div>
                          <div className="mt-0.5 scale-[0.85] origin-left"><StatusBadge status={c.status} /></div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12.5px] text-neutral-400">팁: 카드를 드래그해서 다른 날짜로 옮기면 발행 예정일이 변경됩니다. 주간 플랜 — 월 시세 / 화 후기 / 수 정보 / 목 FAQ / 금 사례 / 토 방문 / 일 영업안내</p>
        </main>
      </div>
    </div>
  );
}
