"use client";

import { ContentType } from "./types";

export interface AIImageStyle {
  id: string;
  name: string;
  desc: string;
  // 영어 프롬프트 suffix (모델에 직접 전달)
  suffix: string;
}

// 금은방 당근 소식에 최적화된 스타일 프리셋
export const AI_IMAGE_STYLES: AIImageStyle[] = [
  {
    id: "trust-shop",
    name: "매장 신뢰형",
    desc: "밝은 귀금속 매장 카운터 + 저울",
    suffix:
      "bright modern Korean gold shop counter interior, precision scale with gold rings and necklace on black tray, warm lighting, clean glass display, professional, photorealistic, no people faces, no text, no watermark",
  },
  {
    id: "closeup-gold",
    name: "금 클로즈업",
    desc: "금반지·목걸이 접사, 고급스러움",
    suffix:
      "extreme close-up of shiny 24k gold rings, gold necklace and gold bar on dark elegant fabric, luxury jewelry photography, soft studio light, shallow depth of field, photorealistic, no text, no watermark",
  },
  {
    id: "consult",
    name: "상담 장면",
    desc: "직원 손 + 고객 손, 감정 장면",
    suffix:
      "Korean jewelry shop staff hands in white gloves showing gold bracelet to customer hands over glass counter, blurred shop background, warm trustworthy mood, photorealistic, faces not visible, no text, no watermark",
  },
  {
    id: "price-board",
    name: "시세 안내형",
    desc: "오늘 시세 느낌 + 금과 계산기",
    suffix:
      "gold bars and gold jewelry next to calculator and notebook on wooden desk, bright daylight, Korean gold buying shop concept, tidy composition, photorealistic, no text, no watermark",
  },
  {
    id: "gift-doljabi",
    name: "돌반지·선물형",
    desc: "아기 돌반지 선물 포장 느낌",
    suffix:
      "small Korean baby gold ring in luxury red gift box with silk cushion, soft pink background, elegant gift photography, photorealistic, no text, no watermark",
  },
  {
    id: "broken-ok",
    name: "끊어진 금도 OK",
    desc: "끊어진 목걸이·한쪽 귀걸이 자연스럽게",
    suffix:
      "broken gold chain necklace and single gold earring on white paper with magnifier, before-appraisal concept, bright clean table, photorealistic, no text, no watermark",
  },
];

function typeToScene(type: ContentType, title: string, body: string): string {
  const t = `${title} ${body}`.slice(0, 600);
  // 한글 핵심 키워드 추출 → 영어 scene 변환
  if (/돌반지|아기|선물/.test(t))
    return "Korean first-birthday baby gold ring gift, celebration mood";
  if (/끊어|한쪽|귀걸이|변색/.test(t))
    return "old broken gold necklace and single earring appraisal, still valuable concept";
  if (/시세|금값|가격|오늘/.test(t))
    return "today gold price concept, gold bars with bright modern shop background";
  if (/영업|방문|매장|위치|주차|찾아/.test(t))
    return "welcoming Korean gold shop storefront interior, open sign mood, bright daytime";
  if (/후기|고객|리뷰|만족/.test(t))
    return "happy customer hands receiving cash envelope after selling gold, warm shop counter";
  if (/이벤트|할인|특가|사은/.test(t))
    return "festive gold jewelry display with gift boxes, promotion mood";
  return "elegant Korean gold buying shop, gold jewelry on counter, trustworthy bright mood";
}

// 글 내용 → 이미지 프롬프트 (GPT/DALL-E/Pollinations 공용)
export function buildImagePrompt(
  title: string,
  body: string,
  styleId: string,
  slot: 1 | 2
): string {
  const style = AI_IMAGE_STYLES.find((s) => s.id === styleId) ?? AI_IMAGE_STYLES[0];
  const scene = typeToScene("자유 주제" as ContentType, title, body);
  const secondAngle =
    slot === 2
      ? "alternate angle, different composition from first image, "
      : "";
  return `${secondAngle}${scene}, ${style.suffix}. vertical-friendly 4:3 composition, high detail`;
}

// 확장프로그램으로 넘길 payload용 압축 프롬프트 (GPT 채팅에 붙여넣기용)
export function buildGptPastePrompt(
  title: string,
  body: string,
  count: 1 | 2,
  styleName: string
): string {
  return `아래 당근 소식 글에 들어갈 실사 이미지 ${count}장을 만들어줘. 스타일: ${styleName}. 얼굴 클로즈업 금지, 글자·워터마크 금지, 4:3 가로형, 따뜻하고 신뢰감 있는 금은방 분위기.\n\n[제목]\n${title}\n\n[본문]\n${body.slice(0, 1500)}`;
}
