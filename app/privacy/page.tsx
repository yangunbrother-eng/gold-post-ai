"use client";
import Link from "next/link";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <main className="max-w-[760px] mx-auto px-4 py-10">
        <Link href="/" className="text-[13px] font-bold text-neutral-500 hover:text-black">← 홈으로</Link>
        <h1 className="mt-3 text-[26px] font-black tracking-tight">개인정보처리방침</h1>
        <p className="mt-1 text-[13px] text-neutral-500">당근 Post AI 웹사이트 및 Chrome 확장 프로그램 · 시행일 2026-09-18</p>
        <div className="mt-6 space-y-4 text-[14px] leading-relaxed text-neutral-700">
          <section className="card p-5">
            <h2 className="font-extrabold text-[15px]">1. 수집하는 정보</h2>
            <p className="mt-2">확장 프로그램은 사용자가 직접 붙여넣은 <b>제목·본문(Payload)</b>을 사용자의 브라우저 저장소(chrome.storage)에만 저장합니다. 서버로 전송하지 않습니다.</p>
          </section>
          <section className="card p-5">
            <h2 className="font-extrabold text-[15px]">2. 정보의 이용 목적</h2>
            <p className="mt-2">저장된 제목·본문을 당근 소식 작성 페이지의 입력칸에 자동으로 채워 넣는 용도로만 사용합니다.</p>
          </section>
          <section className="card p-5">
            <h2 className="font-extrabold text-[15px]">3. 보관 및 파기</h2>
            <p className="mt-2">정보는 사용자 PC의 브라우저 안에만 보관되며, 확장을 삭제하면 함께 삭제됩니다. 외부 서버에 보관하지 않으므로 별도 파기 절차가 필요 없습니다.</p>
          </section>
          <section className="card p-5">
            <h2 className="font-extrabold text-[15px]">4. 제3자 제공 및 처리위탁</h2>
            <p className="mt-2">수집 정보를 제3자에게 제공하거나 처리위탁하지 않습니다. 광고·분석 도구를 사용하지 않습니다.</p>
          </section>
          <section className="card p-5">
            <h2 className="font-extrabold text-[15px]">5. 이용자 권리</h2>
            <p className="mt-2">확장 팝업에서 저장된 내용을 언제든 덮어쓰거나, 확장을 삭제하여 저장 정보를 제거할 수 있습니다.</p>
          </section>
          <section className="card p-5">
            <h2 className="font-extrabold text-[15px]">6. 문의</h2>
            <p className="mt-2">금박사 제주점 · 전화 0508-9302-3898 · 제주특별자치도 제주시 연북로 161 (연동)</p>
          </section>
        </div>
      </main>
    </div>
  );
}
