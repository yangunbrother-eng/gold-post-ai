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
    "보관": "bg-neutral-50 text-neutral-500 border-neutral-200"
  };
  return <span className={`inline-flex items-center whitespace-nowrap text-[11px] font-semibold border rounded-full px-2 py-0.5 ${map[status] ?? "bg-neutral-100 text-neutral-600 border-neutral-200"}`}>{status}</span>;
}
export function TypeBadge({ type }: { type: string }) {
  return <span className="inline-flex text-[11px] font-semibold bg-neutral-100 text-neutral-600 rounded-full px-2 py-0.5">{type}</span>;
}
export default function PhonePreview({ title, body, bizName, time, imageCopy, imageSub, bg, secondImage, logo, logoText, aiImages }: {
  title: string; body: string; bizName: string; time: string;
  imageCopy: string; imageSub: string; bg: string; secondImage?: { copy: string; bg: string } | null;
  logo?: string | null; logoText?: string; aiImages?: string[];
}) {
  const [logoOk, setLogoOk] = useState(true);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => { setLogoOk(true); }, [logo]);
  return <div className="phone-frame">
    <div className="bg-white px-4 pt-4 pb-3 flex items-center gap-2.5 border-b border-neutral-100">
      {logo && logoOk ? <img src={logo} alt={logoText || "매장 로고"} className="w-10 h-10 rounded-full object-cover border border-neutral-200" onError={() => setLogoOk(false)} /> : <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: bg || "#302c25" }}>{bizName.slice(0, 1)}</div>}
      <div className="flex-1 min-w-0"><div className="text-[13px] font-bold truncate">{bizName || "업체명"}</div><div className="text-[11px] text-neutral-500 mt-1">{time} · 소식</div></div>
    </div>
    {aiImages?.length ? aiImages.map((url, i) => <div key={`${i}-${url.slice(-20)}`} className="relative aspect-[4/3] bg-neutral-100 overflow-hidden"><img src={url} alt={`소식 이미지 ${i + 1}`} className="w-full h-full object-cover" /><span className="absolute bottom-3 right-3 text-[11px] text-white bg-black/50 rounded-full px-2 py-0.5">{i + 1} / {aiImages.length}</span></div>) : imageCopy ? <div className="aspect-[4/3] flex flex-col items-center justify-center text-center p-6 text-white" style={{ background: bg || "#302c25" }}><strong className="text-[26px] font-extrabold leading-snug">{imageCopy}</strong><span className="mt-2 text-[13px] opacity-80">{imageSub}</span></div> : null}
    {secondImage && !aiImages?.length && <div className="aspect-[16/9] flex items-center justify-center text-white text-center p-6" style={{ background: secondImage.bg }}>{secondImage.copy}</div>}
    <div className="px-4 py-4"><h3 className="text-[16px] font-bold leading-snug">{title || "소식 제목"}</h3><div className={`mt-3 text-[14px] text-neutral-700 leading-relaxed whitespace-pre-wrap ${expanded ? "" : "line-clamp-[12]"}`}>{body || "본문을 작성해 주세요."}</div>
      {body.length > 300 && <button type="button" className="ws-text-link" onClick={() => setExpanded(!expanded)}>{expanded ? "접기" : "본문 전체 보기"}</button>}
      <div className="mt-4 flex gap-2" aria-hidden="true"><span className="flex-1 text-center text-[13px] font-bold rounded-xl py-2.5 text-white" style={{ background: bg || "#302c25" }}>채팅하기</span><span className="flex-1 text-center text-[13px] font-bold rounded-xl py-2.5 border border-neutral-200">전화하기</span></div>
      <p className="mt-3 text-[11px] text-neutral-500 text-center">미리보기예요. 실제 발행·문의·반응 수는 표시하지 않아요.</p>
    </div>
  </div>;
}
