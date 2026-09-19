"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// /images 단독 페이지는 폐지 → /create 소식 만들기 안의 이미지 섹션으로 통합
export default function ImagesRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/create#images");
  }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-[15px] font-extrabold">이미지 만들기가 당근 소식 만들기에 합쳐졌어요 ✦</div>
        <div className="mt-1 text-[13px] text-neutral-500">글 쓰고 → 장수 선택 → AI 이미지 생성까지 한 화면에서 됩니다.</div>
        <a href="/create#images" className="btn-primary inline-block mt-4 px-6 py-3 text-[14px] font-bold rounded-xl">
          소식 만들기에서 이미지 만들기 →
        </a>
      </div>
    </div>
  );
}
