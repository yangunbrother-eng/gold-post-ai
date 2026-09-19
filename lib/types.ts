export type ContentType =
  | "시세" | "고객 후기" | "실제 사례" | "상품 소개" | "FAQ"
  | "이벤트" | "영업 안내" | "방문 안내" | "정보성" | "후기형" | "문의 유도형" | "자유 주제";

export type ContentStatus = "초안" | "AI 작성 완료" | "검수 완료" | "발행 예정" | "발행됨" | "보관" | "작성 필요";

export interface GeneratedPost {
  title: string;
  hook: string;
  body: string;
  coreMessage: string;
  cta: string;
  imageCopy: string;
  imageSubCopy: string;
  hashtags: string[];
  type: ContentType;
}

export interface ContentItem {
  id: string;
  title: string;
  body: string;
  hook: string;
  coreMessage: string;
  cta: string;
  imageCopy: string;
  imageSubCopy: string;
  hashtags: string[];
  type: ContentType;
  status: ContentStatus;
  date: string; // YYYY-MM-DD
  createdAt: string;
  images: { id: string; label: string; copy: string; bg: string; sub?: string }[];
  branchId: string;
  publishNote?: string;
  sourceUrl?: string; // 당근 원문 링크 (실제 발행글인 경우)
}

export interface BrandSettings {
  businessName: string;
  color: string;
  address: string;
  phone: string;
  hours: string;
  intro: string;
  defaultCta: string;
  phrases: string[];
  logoText: string;
  logoUrl?: string;
}

export interface Template {
  id: string;
  name: string;
  desc: string;
  type: ContentType;
  structure: string;
  example: string;
}

export interface Branch {
  id: string;
  name: string;
  address: string;
}
