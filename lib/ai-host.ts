"use client";

export type HostAi = "auto" | "template" | "chatgpt" | "gemini";

// 호스트 GPT(ChatGPT/Gemini 새 탭)에 넘길 지시문 — 출력 형식을 고정시켜 붙여넣기 파싱이 되게 함
export function buildHostPrompt(
  topic: string,
  brand: { businessName: string; address: string; phone: string; hours: string; intro: string; defaultCta: string },
  tone: string,
  type: string
): string {
  return `당근 비즈프로필(동네 가게 소식) 글을 작성해줘. 반드시 아래 형식 그대로 출력해줘.

[주제] ${topic}
[글 유형] ${type}
[말투] ${tone}
[업체명] ${brand.businessName} / [주소] ${brand.address} / [전화] ${brand.phone} / [영업시간] ${brand.hours}
[소개] ${brand.intro}
[CTA] ${brand.defaultCta}

규칙: 한국어, 과장·허위 금지, 이모지 2개 이내, 2~3문장마다 문단을 나누고 문단 사이에 빈 줄 1개 넣기, 본문 끝에 주소·영업시간·전화와 CTA 포함, 해시태그는 본문과 빈 줄로 분리하여 실제 해시태그 3~5개(지역명 포함) 작성. 아래 괄호 속 안내문이나 #태그1 같은 자리표시자를 답변에 그대로 쓰지 말 것.
글 공식: ① 후킹(첫 문장 주목) → ② 문제제기(고객의 고민·불안) → ③ 공감(“당연하다/잘 안다”) → ④ 문제해결(구체적 답+증거) → CTA. 소제목 라벨 없이 자연스럽게 이어 쓸 것.

출력 형식(반드시 지킬 것):
제목: (30자 이내 한 줄)
본문:
(여기에 본문 전체)
해시태그: #태그1 #태그2 #태그3`;
}

// ChatGPT/Gemini 새 탭을 열고, 확장(gpt-autorun.js)이 클립보드에서 프롬프트를 읽어 전송함
// ※ ?q= 파라미터 방식 제거 — ChatGPT가 ?q= 받으면 즉시 자동제출해서 gpt-autorun.js 개입 불가
// ※ 클립보드에 프롬프트를 복사해두면 gpt-autorun.js가 읽어서 입력+전송까지 처리함
export function openHostAi(
  host: "chatgpt" | "gemini",
  prompt: string,
  options?: { mode?: "text" | "image"; count?: number; slots?: number[]; requestId?: string }
) {
  // 프롬프트를 fragment에도 담아 확장프로그램이 클립보드 권한과 무관하게 바로 읽을 수 있게 한다.
  // fragment는 서버로 전송되지 않으며, cpai=1 표식이 있는 탭에서만 확장이 자동 입력/전송한다.
  const params = new URLSearchParams({ cpai: "1", prompt });
  if (options?.requestId) params.set("requestId", options.requestId);
  if (options?.mode === "image") {
    params.set("mode", "image");
    params.set("count", String(Math.min(2, Math.max(1, options.count || 1))));
    params.set("slots", (options.slots || [0]).slice(0, 2).join(","));
  }
  const hash = `#${params.toString()}`;
  const href = host === "chatgpt"
    ? `https://chatgpt.com/${hash}`
    : `https://gemini.google.com/app${hash}`;

  const a = document.createElement("a");
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Preserve the shared importer API used by the composer.
export { splitPasted, isWritingPrompt } from "./pasted-post";
