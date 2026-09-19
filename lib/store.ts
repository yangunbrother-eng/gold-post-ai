"use client";
import { useEffect, useState } from "react";
import { BrandSettings, ContentItem } from "./types";
import { BRANCHES, DEFAULT_BRAND, REAL_POSTS } from "./sample-data";

const K_CONTENTS = "cpai_contents_v1";
const K_TONE = "cpai_tone_v1";
const K_BRANCH_BRANDS = "cpai_branch_brands_v5";
const K_ACTIVE_BRANCH = "cpai_active_branch_v4";
const K_CUSTOM_BRANCHES = "cpai_custom_branches_v4";
const CHANGED = "cpai:store-changed";
function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; }
  catch { return fallback; }
}
function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event(CHANGED));
    return true;
  } catch { return false; }
}
function subscribe(refresh: () => void) {
  window.addEventListener("storage", refresh);
  window.addEventListener(CHANGED, refresh);
  return () => { window.removeEventListener("storage", refresh); window.removeEventListener(CHANGED, refresh); };
}
function readContents(): ContentItem[] {
  const stored = load<ContentItem[]>(K_CONTENTS, REAL_POSTS);
  if (!Array.isArray(stored)) return REAL_POSTS;
  const fake = new Set(["c1", "c2", "c3", "c4", "c5", "c6"]);
  return stored.filter((i) => i && typeof i.id === "string" && !fake.has(i.id));
}
export function useContents() {
  const [items, setItems] = useState<ContentItem[]>(REAL_POSTS);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const refresh = () => { setItems(readContents()); setLoaded(true); };
    refresh();
    return subscribe(refresh);
  }, []);
  const save = (next: ContentItem[]) => {
    if (!write(K_CONTENTS, next)) return false;
    setItems(next);
    return true;
  };
  const upsert = (item: ContentItem) => {
    const current = readContents();
    return save(current.some((i) => i.id === item.id) ? current.map((i) => i.id === item.id ? item : i) : [item, ...current]);
  };
  const remove = (id: string) => save(readContents().filter((i) => i.id !== id));
  return { items, save, upsert, remove, loaded };
}
export interface BranchInfo { id: string; name: string; address: string; }
export const JEJU_BRANCH: BranchInfo = {
  id: "jeju", name: "금박사 제주점", address: "제주특별자치도 제주시 연북로 161 (연동)"
};
export const JEJU_BRAND: BrandSettings = {
  businessName: "금박사 제주점", color: "#2A2118",
  address: "제주특별자치도 제주시 연북로 161 (연동)", phone: "0508-9302-3898",
  hours: "24시간 문의 가능 (00:00–24:00)",
  intro: "제주 전 지역 출장 · 당일 시세 100% 적용 · 현장 바로입금 5분 거래",
  defaultCta: "📩 전화 0508-9302-3898 또는 채팅 주세요. 제주 어디든 직접 찾아갑니다.",
  phrases: ["제주 최고가로 매입해 드립니다.", "이물질 무료 정리 · 수수료 0원", "단골 맺으면 무료 출장 감정 쿠폰"],
  logoText: "금박사", logoUrl: "/geumbaksa-logo.png"
};
function baseBrands(): Record<string, BrandSettings> {
  return {
    jeju: JEJU_BRAND, b1: DEFAULT_BRAND,
    b2: { ...DEFAULT_BRAND, businessName: "한국금거래소 병점점", address: "경기도 화성시 병점동 456", phone: "031-234-5678" },
    b3: { ...DEFAULT_BRAND, businessName: "한국금거래소 수원점", address: "경기도 수원시 영통구 789", phone: "031-345-6789" }
  };
}
export const BASE_BRANCH_LIST: BranchInfo[] = [JEJU_BRANCH, ...BRANCHES];
export function useBrand() {
  const [brands, setBrandsState] = useState<Record<string, BrandSettings>>(baseBrands);
  const [activeId, setActiveId] = useState("jeju");
  const [custom, setCustom] = useState<BranchInfo[]>([]);
  const [tone, setToneState] = useState("친근한 상담형");
  useEffect(() => {
    const refresh = () => {
      setBrandsState({ ...baseBrands(), ...load<Record<string, BrandSettings>>(K_BRANCH_BRANDS, {}) });
      setActiveId(load<string>(K_ACTIVE_BRANCH, "jeju"));
      const extra = load<BranchInfo[]>(K_CUSTOM_BRANCHES, []);
      setCustom(Array.isArray(extra) ? extra : []);
      setToneState(load<string>(K_TONE, "친근한 상담형"));
    };
    refresh();
    return subscribe(refresh);
  }, []);
  const brand = brands[activeId] ?? JEJU_BRAND;
  const setBrand = (b: BrandSettings) => {
    const current = { ...baseBrands(), ...load<Record<string, BrandSettings>>(K_BRANCH_BRANDS, {}) };
    return write(K_BRANCH_BRANDS, { ...current, [activeId]: b });
  };
  const switchBranch = (id: string) => write(K_ACTIVE_BRANCH, id);
  const addBranch = (name: string, address: string) => {
    const id = uid();
    const extras = load<BranchInfo[]>(K_CUSTOM_BRANCHES, []);
    if (!write(K_CUSTOM_BRANCHES, [...extras, { id, name, address }])) return false;
    const current = { ...baseBrands(), ...load<Record<string, BrandSettings>>(K_BRANCH_BRANDS, {}) };
    if (!write(K_BRANCH_BRANDS, { ...current, [id]: { ...DEFAULT_BRAND, businessName: name, address } })) return false;
    return switchBranch(id);
  };
  const setTone = (t: string) => write(K_TONE, t);
  useEffect(() => { document.documentElement.style.setProperty("--brand", brand.color); }, [brand.color]);
  const branches = [...BASE_BRANCH_LIST, ...custom];
  const activeBranch = branches.find((b) => b.id === activeId) ?? BASE_BRANCH_LIST[0];
  return { brand, setBrand, tone, setTone, branches, activeBranchId: activeId, activeBranch, switchBranch, addBranch };
}
export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
// All daily counts and schedules use the same Korean calendar date, not UTC.
export const todayStr = () => {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
};
