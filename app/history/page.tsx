"use client";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { StatusBadge, TypeBadge } from "@/components/PhonePreview";
import { useBrand, useContents } from "@/lib/store";

export default function History() {
  const { brand } = useBrand();
  const { items } = useContents();
  const published = items.filter((i) => i.status === "발행됨" || i.status === "발행 예정");
  return (
    <div className="min-h-screen flex">
      <Sidebar bizName={brand.businessName} extConnected={false} />
      <div className="flex-1 min-w-0">
        <Topbar title="발행 이력" sub="당근 게시 기록" />
        <main className="max-w-[900px] mx-auto px-4 lg:px-8 py-6 space-y-4">
          <div className="hidden lg:block"><h1 className="text-[26px] font-black tracking-tight">발행 이력</h1></div>
          <div className="relative pl-6 space-y-4 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-px before:bg-neutral-200">
            {(published.length ? published : items).map((c) => (
              <div key={c.id} className="relative">
                <span className={`absolute -left-6 top-5 w-[15px] h-[15px] rounded-full border-[3px] ${c.status === "발행됨" ? "border-emerald-500 bg-white" : "border-neutral-300 bg-white"}`} />
                <div className="card p-5">
                  <div className="flex items-center gap-2 flex-wrap"><span className="text-[12px] font-bold text-neutral-400">{c.date} {c.createdAt}</span><TypeBadge type={c.type} /><StatusBadge status={c.status} /></div>
                  <div className="mt-1.5 font-extrabold text-[15px]">{c.title}</div>
                  <div className="text-[13px] text-neutral-500 mt-1 line-clamp-2">{c.body}</div>
                  <div className="mt-2 text-[12px] text-neutral-400">채널: 당근 비즈프로필 소식 · 방식: 자동 입력 + 수동 등록 · 이미지 {c.images.length}장</div>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
