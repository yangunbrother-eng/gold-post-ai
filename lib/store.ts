"use client";
import { useEffect, useState } from "react";
import { BrandSettings, ContentItem } from "./types";
import { BRANCHES, DEFAULT_BRAND, REAL_POSTS } from "./sample-data";

const K_CONTENTS = "cpai_contents_v1";
const K_BRAND = "cpai_brand_v4";
const K_TONE = "cpai_tone_v1";
const K_BRANCH_BRANDS = "cpai_branch_brands_v4";
const K_ACTIVE_BRANCH = "cpai_active_branch_v4";
const K_CUSTOM_BRANCHES = "cpai_custom_branches_v4";

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch { return fallback; }
}

// Supabase 연동 포인트: 이 파일의 load/save만 교체하면 클라우드 동기화로 전환됨.
// 테이블: users, businesses, brand_settings, contents, content_templates, images, publish_history, content_schedule
export function useContents() {
  const [items, setItems] = useState<ContentItem[]>(REAL_POSTS);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const stored = load<ContentItem[]>(K_CONTENTS, REAL_POSTS);
    // 가짜 샘플(c1~c6) 제거 + 실제 당근 발행글이 없으면 앞에 추가
    const FAKE = new Set(["c1", "c2", "c3", "c4", "c5", "c6"]);
    const cleaned = stored.filter((i) => !FAKE.has(i.id));
    const ids = new Set(cleaned.map((i) => i.id));
    const missing = REAL_POSTS.filter((r) => !ids.has(r.id));
    const seedById = new Map(REAL_POSTS.map((r) => [r.id, r]));
    // 실제글은 시드 기준으로 날짜·출처·실측 갱신 (제목·본문 수정분은 유지)
    const merged = [...missing, ...cleaned].map((i) => {
      const s = seedById.get(i.id);
      return s ? { ...i, date: s.date, createdAt: s.createdAt, publishNote: s.publishNote, sourceUrl: s.sourceUrl } : i;
    });
    setItems(merged);
    try { localStorage.setItem(K_CONTENTS, JSON.stringify(merged)); } catch {}
    setLoaded(true);
  }, []);
  const save = (next: ContentItem[]) => {
    setItems(next);
    try { localStorage.setItem(K_CONTENTS, JSON.stringify(next)); } catch {}
  };
  const upsert = (item: ContentItem) => {
    const exists = items.some((i) => i.id === item.id);
    save(exists ? items.map((i) => (i.id === item.id ? item : i)) : [item, ...items]);
  };
  const remove = (id: string) => save(items.filter((i) => i.id !== id));
  return { items, save, upsert, remove, loaded };
}

export interface BranchInfo {
  id: string;
  name: string;
  address: string;
}

// 실제 업체 — 당근 비즈프로필(금박사, 제주 제주시 연동)에서 가져온 정보
export const JEJU_BRANCH: BranchInfo = {
  id: "jeju",
  name: "금박사 제주점",
  address: "제주특별자치도 제주시 연북로 161 (연동)"
};

export const JEJU_BRAND: BrandSettings = {
  businessName: "금박사 제주점",
  color: "#FF6F0F",
  address: "제주특별자치도 제주시 연북로 161 (연동)",
  phone: "0508-9302-3898",
  hours: "24시간 문의 가능 (00:00–24:00)",
  intro: "제주 전 지역 출장 · 당일 시세 100% 적용 · 현장 바로입금 5분 거래",
  defaultCta: "📩 전화 0508-9302-3898 또는 채팅 주세요. 제주 어디든 직접 찾아갑니다.",
  phrases: ["제주 최고가로 매입해 드립니다.", "이물질 무료 정리 · 수수료 0원", "단골 맺으면 무료 출장 감정 쿠폰"],
  logoText: "금박사",
  logoUrl: "/geumbaksa-logo.png"
};

function baseBrands(): Record<string, BrandSettings> {
  return {
    jeju: JEJU_BRAND,
    b1: DEFAULT_BRAND,
    b2: { ...DEFAULT_BRAND, businessName: "한국금거래소 병점점", address: "경기도 화성시 병점동 456", phone: "031-234-5678" },
    b3: { ...DEFAULT_BRAND, businessName: "한국금거래소 수원점", address: "경기도 수원시 영통구 789", phone: "031-345-6789" }
  };
}

export const BASE_BRANCH_LIST: BranchInfo[] = [JEJU_BRANCH, ...BRANCHES];

export function useBrand() {
  const [brands, setBrandsState] = useState<Record<string, BrandSettings>>(baseBrands());
  const [activeId, setActiveId] = useState("jeju");
  const [custom, setCustom] = useState<BranchInfo[]>([]);
  const [tone, setToneState] = useState("친근한 상담형");
  useEffect(() => {
    const stored = load<Record<string, BrandSettings> | null>(K_BRANCH_BRANDS, null);
    if (stored && Object.keys(stored).length) {
      setBrandsState({ ...baseBrands(), ...stored });
    } else {
      setBrandsState(baseBrands());
    }
    setActiveId(load<string>(K_ACTIVE_BRANCH, "jeju"));
    setCustom(load<BranchInfo[]>(K_CUSTOM_BRANCHES, []));
    setToneState(load<string>(K_TONE, "친근한 상담형"));
  }, []);
  const persistBrands = (b: Record<string, BrandSettings>) => {
    setBrandsState(b);
    try { localStorage.setItem(K_BRANCH_BRANDS, JSON.stringify(b)); } catch {}
  };
  const brand = brands[activeId] ?? baseBrands()[activeId] ?? JEJU_BRAND;
  const setBrand = (b: BrandSettings) => persistBrands({ ...brands, [activeId]: b });
  const switchBranch = (id: string) => {
    setActiveId(id);
    try { localStorage.setItem(K_ACTIVE_BRANCH, JSON.stringify(id)); } catch {}
  };
  const addBranch = (name: string, address: string) => {
    const id = uid();
    const nb = [...custom, { id, name, address }];
    setCustom(nb);
    try { localStorage.setItem(K_CUSTOM_BRANCHES, JSON.stringify(nb)); } catch {}
    persistBrands({ ...brands, [id]: { ...DEFAULT_BRAND, businessName: name, address } });
    switchBranch(id);
  };
  const setTone = (t: string) => {
    setToneState(t);
    try { localStorage.setItem(K_TONE, JSON.stringify(t)); } catch {}
  };
  useEffect(() => {
    document.documentElement.style.setProperty("--brand", brand.color);
  }, [brand.color]);
  const branches = [...BASE_BRANCH_LIST, ...custom];
  const activeBranch = branches.find((b) => b.id === activeId) ?? BASE_BRANCH_LIST[0];
  return { brand, setBrand, tone, setTone, branches, activeBranchId: activeId, activeBranch, switchBranch, addBranch };
}

export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
export const todayStr = () => new Date().toISOString().slice(0, 10);
