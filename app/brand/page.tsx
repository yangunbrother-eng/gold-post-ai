"use client";
import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import PhonePreview from "@/components/PhonePreview";
import { useBrand } from "@/lib/store";

const COLORS = ["#FF6F0F", "#111111", "#1A3A2E", "#14324F", "#5B3DF5", "#C24E00"];

export default function Brand() {
  const { brand, setBrand, activeBranchId, activeBranch } = useBrand();
  const [f, setF] = useState(brand);
  const [lastId, setLastId] = useState(activeBranchId);
  const [toast, setToast] = useState("");
  // 지점 전환 시 해당 지점 정보로 폼 교체
  if (lastId !== activeBranchId) { setLastId(activeBranchId); setF(brand); }
  else if (f.businessName !== brand.businessName && !f.businessName) setF(brand);
  const set = (k: keyof typeof f, v: string | string[]) => setF({ ...f, [k]: v } as typeof f);
  const onLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const im = new Image();
      im.onload = () => {
        const S = 256;
        const c = document.createElement("canvas");
        c.width = S; c.height = S;
        const cx = c.getContext("2d");
        if (!cx) return;
        const side = Math.min(im.width, im.height);
        cx.drawImage(im, (im.width - side) / 2, (im.height - side) / 2, side, side, 0, 0, S, S);
        set("logoUrl", c.toDataURL("image/png"));
        setToast("로고 등록됨 · 저장하기를 눌러 확정하세요");
        setTimeout(() => setToast(""), 1600);
      };
      im.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };
  return (
    <div className="min-h-screen flex">
      <Sidebar bizName={brand.businessName} extConnected={false} />
      <div className="flex-1 min-w-0">
        <Topbar title="브랜드 설정" sub="AI가 자동 반영" />
        <main className="max-w-[1080px] mx-auto px-4 lg:px-8 py-6 grid lg:grid-cols-[1fr_360px] gap-5">
          <div className="card p-5 lg:p-6 space-y-4">
            <h1 className="hidden lg:block text-[22px] font-black tracking-tight">브랜드 설정 <span className="text-[13px] font-semibold text-neutral-400">· 편집 중: {activeBranch.name}</span></h1>
            {[
              ["업체명", "businessName", f.businessName],
              ["주소", "address", f.address],
              ["전화번호", "phone", f.phone],
              ["영업시간", "hours", f.hours],
              ["소개 문구", "intro", f.intro],
              ["기본 CTA", "defaultCta", f.defaultCta],
              ["로고 텍스트", "logoText", f.logoText]
            ].map(([label, key, val]) => (
              <div key={key}><div className="label mb-1.5">{label}</div>
                <input value={val as string} onChange={(e) => set(key as keyof typeof f, e.target.value)} className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-[14px] outline-none focus:border-neutral-400" />
              </div>
            ))}
            <div><div className="label mb-2">대표 색상 · 사이트 포인트 + 이미지 테마에 반영</div>
              <div className="flex gap-2">{COLORS.map((c) => (<button key={c} onClick={() => set("color", c)} className={`w-10 h-10 rounded-xl border-2 ${f.color === c ? "border-neutral-900 scale-105" : "border-neutral-200"}`} style={{ background: c }} />))}</div>
            </div>
            <div><div className="label mb-1.5">로고 이미지 · 미리보기와 다운로드 이미지에 표시</div>
              <div className="flex items-center gap-3">
                {f.logoUrl
                  ? <img src={f.logoUrl} alt="로고" className="w-14 h-14 rounded-full object-cover border border-neutral-200 bg-white" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  : <div className="w-14 h-14 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 text-[11px] font-bold">없음</div>}
                <label className="btn-ghost px-4 py-2.5 text-[13px] font-bold cursor-pointer">로고 올리기<input type="file" accept="image/*" className="hidden" onChange={onLogo} /></label>
                {f.logoUrl && <button onClick={() => set("logoUrl", "")} className="text-[12.5px] font-bold text-neutral-400 hover:text-red-500">지우기</button>}
              </div>
              <p className="text-[11.5px] text-neutral-400 mt-1.5">당근 프로필 사진을 저장해서 올리면 됩니다. 올린 로고는 이 브라우저에 저장됩니다.</p>
            </div>
            <div><div className="label mb-1.5">자주 사용하는 문구 (쉼표로 구분)</div>
              <input value={f.phrases.join(", ")} onChange={(e) => set("phrases", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-[14px] outline-none" />
            </div>
            <button onClick={() => { setBrand(f); setToast("브랜드 저장됨 · 이후 모든 콘텐츠에 자동 적용"); setTimeout(() => setToast(""), 1600); }} className="btn-primary px-6 py-3.5 text-[14px] font-bold w-full">저장하기</button>
          </div>
          <div className="card p-5 h-fit lg:sticky lg:top-6">
            <div className="text-[13px] font-extrabold mb-3">브랜드 미리보기</div>
            <div className="flex justify-center"><PhonePreview title="오늘 금값, 지금 팔아도 될까요?" body={`${f.intro}\n\n${f.defaultCta}`} bizName={f.businessName} time="방금 전" imageCopy="오늘 금값 확인하세요" imageSub={f.businessName} bg={f.color} logo={f.logoUrl || brand.logoUrl} logoText={f.logoText} /></div>
          </div>
        </main>
      </div>
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-neutral-900 text-white text-[13px] font-bold rounded-full px-5 py-2.5">{toast}</div>}
    </div>
  );
}
