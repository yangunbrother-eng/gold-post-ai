"use client";
import Link from "next/link";
import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { TypeBadge } from "@/components/PhonePreview";
import { TEMPLATES } from "@/lib/sample-data";
import { useBrand } from "@/lib/store";

export default function Templates() {
  const { brand } = useBrand();
  const [list, setList] = useState(TEMPLATES);
  const [name, setName] = useState("");
  return (
    <div className="min-h-screen flex">
      <Sidebar bizName={brand.businessName} extConnected={false} />
      <div className="flex-1 min-w-0">
        <Topbar title="템플릿" sub="자주 쓰는 형식 저장" />
        <main className="max-w-[1000px] mx-auto px-4 lg:px-8 py-6 space-y-4">
          <div className="hidden lg:block"><h1 className="text-[26px] font-black tracking-tight">템플릿</h1><p className="text-[13.5px] text-neutral-500">시세·후기·FAQ 등 고정 형식을 저장해 매번 같은 품질로 발행</p></div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {list.map((t) => (
              <div key={t.id} className="card p-5">
                <TypeBadge type={t.type} />
                <div className="mt-2 font-extrabold tracking-tight">{t.name}</div>
                <div className="text-[12.5px] text-neutral-500 mt-1">{t.desc}</div>
                <div className="mt-2 text-[12px] bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 font-medium">{t.structure}</div>
                <div className="mt-2 text-[12.5px] text-neutral-500">예시: “{t.example}”</div>
                <Link href={`/create?topic=${encodeURIComponent(t.example)}`} className="mt-3 block text-center btn-ghost py-2.5 text-[12.5px] font-bold">이 템플릿으로 만들기 →</Link>
              </div>
            ))}
          </div>
          <div className="card p-5 flex flex-col sm:flex-row gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="새 템플릿 이름 (예: 주말 방문 유도 템플릿)" className="flex-1 rounded-xl border border-neutral-200 px-4 py-3 text-[14px] outline-none" />
            <button onClick={() => { if (!name.trim()) return; setList([...list, { id: String(Date.now()), name, desc: "사용자 저장 템플릿", type: "자유 주제", structure: "Hook → 핵심 3가지 → CTA", example: name }]); setName(""); }} className="btn-primary px-5 py-3 text-[13px] font-bold">＋ 템플릿 저장</button>
          </div>
        </main>
      </div>
    </div>
  );
}
