"use client";
import { useEffect, useState } from "react";

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    "발행됨": "bg-emerald-50 text-emerald-700 border-emerald-200",
    "발행 예정": "bg-amber-50 text-amber-700 border-amber-200",
    "검수 완료": "bg-blue-50 text-blue-700 border-blue-200",
    "AI 작성 완료": "bg-violet-50 text-violet-700 border-violet-200",
    "초안": "bg-neutral-100 text-neutral-600 border-neutral-200",
    "작성 필요": "bg-red-50 text-red-600 border-red-200",
    "보관": "bg-neutral-50 text-neutral-400 border-neutral-200"
  };
  return <span className={`text-[11px] font-bold border rounded-full px-2 py-0.5 ${map[status] ?? "bg-neutral-100 text-neutral-600 border-neutral-200"}`}>{status}</span>;
}

export function TypeBadge({ type }: { type: string }) {
  return <span className="text-[11px] font-semibold bg-neutral-900 text-white rounded-full px-2 py-0.5">{type}</span>;
}

export default function PhonePreview({ title, body, bizName, time, imageCopy, imageSub, bg, secondImage, logo, logoText, aiImages }: {
  title: string; body: string; bizName: string; time: string;
  imageCopy: string; imageSub: string; bg: string; secondImage?: { copy: string; bg: string } | null;
  logo?: string | null; logoText?: string; aiImages?: string[];
}) {
  const [logoOk, setLogoOk] = useState(true);
  useEffect(() => { setLogoOk(true); }, [logo]);
  const showLogo = !!logo && logoOk;
  return (
    <div className="phone-frame">
      <div className="bg-white px-4 pt-3 pb-2 flex items-center gap-2.5 border-b border-neutral-100">
        {showLogo ? (
          <img src={logo as string} alt="로고" className="w-10 h-10 rounded-full object-cover border border-neutral-200 bg-white" onError={() => setLogoOk(false)} />
        ) : (
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-black" style={{ background: bg || "var(--brand)" }}>
            {bizName.slice(0, 1)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold truncate">{bizName || "업체명"}</div>
          <div className="text-[11px] text-neutral-400">{time} · 동네인증 · 소식</div>
        </div>
        <span className="text-[11px] text-neutral-400">···</span>
      </div>
      {aiImages && aiImages.length > 0 ? (
        <>
          <div className="relative aspect-[4/3] bg-neutral-100 overflow-hidden">
            <img src={aiImages[0]} alt="AI 대표 이미지" className="w-full h-full object-cover" />
            <div className="absolute bottom-3 right-3 text-[10px] text-white font-bold bg-black/50 rounded-full px-2 py-0.5">1/ {aiImages.length}</div>
          </div>
          {aiImages[1] && (
            <div className="relative aspect-[16/9] bg-neutral-100 overflow-hidden border-t border-neutral-100">
              <img src={aiImages[1]} alt="AI 이미지 2" className="w-full h-full object-cover" />
              <div className="absolute top-2 left-3 text-[10px] font-bold text-white bg-black/50 rounded-full px-2 py-0.5">이미지 2</div>
            </div>
          )}
        </>
      ) : imageCopy ? (
        <div className="relative aspect-[4/3] flex flex-col items-center justify-center text-center px-6" style={{ background: bg || "#111" }}>
          {showLogo ? (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/35 rounded-full pl-1 pr-2.5 py-1">
              <img src={logo as string} alt="" className="w-6 h-6 rounded-full object-cover bg-white" onError={() => setLogoOk(false)} />
              <span className="text-[10px] font-bold text-white">{logoText || bizName}</span>
            </div>
          ) : (
            <div className="absolute top-3 left-3 text-[10px] font-bold text-white/70 border border-white/30 rounded-full px-2 py-0.5">대표 이미지</div>
          )}
          <div className="text-white font-black leading-tight tracking-tight" style={{ fontSize: imageCopy.length > 12 ? 26 : 32 }}>{imageCopy}</div>
          {imageSub && <div className="mt-2 text-white/80 text-[12px] font-semibold">{imageSub}</div>}
          <div className="absolute bottom-3 right-3 text-[10px] text-white/60 font-semibold">1/ {secondImage ? 2 : 1}</div>
        </div>
      ) : (
        <div className="aspect-[4/3] bg-neutral-100 flex items-center justify-center text-neutral-400 text-[13px]">대표 이미지를 생성하세요</div>
      )}
      {secondImage && (
        <div className="relative aspect-[16/9] flex items-center justify-center" style={{ background: secondImage.bg }}>
          <div className="absolute top-2 left-3 text-[10px] font-bold text-white/70 border border-white/30 rounded-full px-2 py-0.5">이미지 2</div>
          <div className="text-white font-extrabold text-[18px] px-6 text-center">{secondImage.copy}</div>
        </div>
      )}
      <div className="px-4 py-3.5">
        <div className="text-[15px] font-extrabold tracking-tight leading-snug">{title || "제목이 여기에 표시됩니다"}</div>
        <div className="mt-2 text-[13px] text-neutral-700 leading-relaxed whitespace-pre-wrap line-clamp-[12]">{body || "본문이 여기에 표시됩니다. AI가 생성한 글이 실시간으로 반영됩니다."}</div>
        <div className="mt-3 flex gap-2">
          <span className="flex-1 text-center text-[13px] font-bold rounded-xl py-2.5 text-white" style={{ background: "var(--brand)" }}>채팅하기</span>
          <span className="flex-1 text-center text-[13px] font-bold rounded-xl py-2.5 border border-neutral-200">전화하기</span>
        </div>
        <div className="mt-2.5 flex items-center gap-3 text-[12px] text-neutral-400">
          <span>♡ 관심 12</span><span>💬 문의 4</span><span className="ml-auto">공유하기</span>
        </div>
      </div>
    </div>
  );
}
