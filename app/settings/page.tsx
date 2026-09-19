"use client";
import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { useBrand } from "@/lib/store";

const TONES = ["친근한 상담형", "전문가형", "정보 전달형", "지역 친화형", "부드러운 홍보형", "광고 느낌 최소화"];

export default function Settings() {
  const { brand, tone, setTone, branches, activeBranchId, switchBranch, addBranch } = useBrand();
  const [newName, setNewName] = useState("");
  const [newAddr, setNewAddr] = useState("");
  const [toast, setToast] = useState("");
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(""), 1500); };
  return (
    <div className="min-h-screen flex">
      <Sidebar bizName={brand.businessName} extConnected={true} />
      <div className="flex-1 min-w-0">
        <Topbar title="설정" sub="말투 · 지점 · 확장" />
        <main className="max-w-[900px] mx-auto px-4 lg:px-8 py-6 space-y-4">
          <div className="hidden lg:block"><h1 className="text-[26px] font-black tracking-tight">설정</h1></div>
          <section className="card p-5 lg:p-6">
            <h3 className="font-extrabold">AI 말투 설정 <span className="text-[12px] font-semibold text-neutral-400 ml-1">기본 톤 저장 → 이후 모든 콘텐츠 자동 적용</span></h3>
            <div className="mt-3 grid sm:grid-cols-3 gap-2">
              {TONES.map((t) => (
                <button key={t} onClick={() => { setTone(t); say(`말투 저장됨: ${t}`); }} className={`rounded-xl border px-4 py-3.5 text-[13.5px] font-bold transition ${tone === t ? "bg-neutral-900 text-white border-neutral-900" : "border-neutral-200 hover:border-neutral-400"}`}>{t}</button>
              ))}
            </div>
          </section>
          <section className="card p-5 lg:p-6">
            <h3 className="font-extrabold">업체 · 지점 관리 <span className="text-[12px] font-semibold text-neutral-400 ml-1">선택하면 사이트 전체에 바로 적용</span></h3>
            <div className="mt-3 grid sm:grid-cols-3 gap-2">
              {branches.map((b) => (
                <button key={b.id} onClick={() => { switchBranch(b.id); say(`${b.name} 선택됨`); }} className={`rounded-xl border p-4 text-left transition ${activeBranchId === b.id ? "border-neutral-900 ring-2 ring-neutral-900/10 bg-neutral-50" : "border-neutral-200"}`}>
                  <div className="font-extrabold text-[14px]">{b.name} {activeBranchId === b.id && <span className="text-[10px] bg-neutral-900 text-white rounded-full px-2 py-0.5 ml-1">사용중</span>}</div><div className="text-[12px] text-neutral-500 mt-0.5">{b.address}</div>
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-col sm:flex-row gap-2">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="새 업체·지점 이름 (예: 금박사 서귀포점)" className="flex-1 rounded-xl border border-neutral-200 px-4 py-2.5 text-[13px] outline-none focus:border-neutral-400" />
              <input value={newAddr} onChange={(e) => setNewAddr(e.target.value)} placeholder="주소" className="flex-1 rounded-xl border border-neutral-200 px-4 py-2.5 text-[13px] outline-none focus:border-neutral-400" />
              <button onClick={() => { if (!newName.trim()) { say("이름을 입력하세요"); return; } addBranch(newName.trim(), newAddr.trim()); say(`${newName} 추가·선택됨`); setNewName(""); setNewAddr(""); }} className="btn-primary w-full sm:w-auto px-5 py-2.5 text-[13px] font-bold shrink-0">＋ 추가</button>
            </div>
          </section>
          <section className="card p-5 lg:p-6" id="extension">
            <h3 className="font-extrabold">Chrome Extension 연동 <span className="text-[12px] font-semibold text-neutral-400 ml-1">제목·본문 자동 입력</span></h3>
            <a href="/extension.zip" download className="mt-3 block text-center btn-primary py-3.5 text-[14px] font-bold">⬇ 확장 프로그램 다운로드</a>
            <ol className="mt-3 space-y-2 text-[13px] text-neutral-600 font-medium">
              {["다운로드한 압축을 풀기 (폴더 1개 나옴)", "크롬 주소창에 chrome://extensions 입력", "오른쪽 위 개발자 모드 켜기", "압축해제된 확장 프로그램을 로드합니다 클릭 → 푼 폴더 선택", "당근 Post AI에서 Payload 복사(이미지 포함) → 당근 작성 페이지에서 확장 아이콘 → 저장 → ✦ AI 글 채우기 (제목·본문·이미지 자동 입력 → 등록만 직접 클릭)"].map((s, i) => (
                <li key={s} className="rounded-xl bg-neutral-50 border border-neutral-200 px-4 py-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span><b>{i + 1}.</b> {s}</span>
                    {s.includes("chrome://extensions") && (
                      <button onClick={async () => { try { await navigator.clipboard.writeText("chrome://extensions"); say("복사됨! 크롬 주소창에 붙여넣으세요"); } catch { say("복사 실패 — chrome://extensions 직접 입력"); } }} className="text-[11.5px] font-bold bg-neutral-900 text-white rounded-lg px-2.5 py-1.5">영어 복사</button>
                    )}
                  </div>
                  {s.includes("개발자 모드") && (
                    <div className="mt-2.5 rounded-xl border border-neutral-200 overflow-hidden bg-white">
                      <div className="bg-neutral-100 px-4 py-1.5 text-[11.5px] font-bold text-neutral-500">▲ 화면 예시 (빨간 화살표 참고)</div>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/guide-devmode.png" alt="개발자 모드 켜기 예시" className="w-full" />
                    </div>
                  )}
                  {s.includes("로드합니다") && (
                    <div className="mt-2.5 rounded-xl border border-neutral-200 overflow-hidden bg-white">
                      <div className="bg-neutral-100 px-4 py-1.5 text-[11.5px] font-bold text-neutral-500">▲ 화면 예시 (파란 버튼 → 폴더 선택)</div>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/guide-load.png" alt="압축해제 확장 로드 예시" className="w-full" />
                    </div>
                  )}
                </li>
              ))}
            </ol>
            <p className="mt-2 text-[12px] text-neutral-400">※ ✦ AI 글 채우기 한 번이면 제목·본문·이미지까지 입력됩니다. 등록 버튼만 직접 확인 후 클릭하세요.</p>
          </section>
          <section className="card p-5 text-[12.5px] text-neutral-500 leading-relaxed">
            <b className="text-neutral-800">기술 구조</b> · Next.js + TypeScript + Tailwind · Supabase 연동 준비 (lib/store.ts의 load/save만 교체) · AI API 분리 (lib/ai.ts) · 이미지 생성 API 연동 포인트 (app/images) · 데이터 테이블: users, businesses, brand_settings, contents, content_templates, images, publish_history, content_schedule
          </section>
        </main>
      </div>
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-neutral-900 text-white text-[13px] font-bold rounded-full px-5 py-2.5">{toast}</div>}
    </div>
  );
}
