"use client";

// 개인 API 키 (브라우저 localStorage 보관 → 요청 때마다 서버로 전달, 서버는 저장 안 함)
const K_OPENAI = "cpai_openai_key";
const K_GEMINI = "cpai_gemini_key";

function load(key: string): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

export function getAiKeys(): { openai: string; gemini: string } {
  return { openai: load(K_OPENAI).trim(), gemini: load(K_GEMINI).trim() };
}

export function saveAiKeys(openai: string, gemini: string) {
  try {
    localStorage.setItem(K_OPENAI, openai.trim());
    localStorage.setItem(K_GEMINI, gemini.trim());
  } catch {
    /* 저장 실패 무시 */
  }
}

export type AiProvider = "template" | "chatgpt" | "gemini";

export function getProviderKey(provider: AiProvider): string {
  const keys = getAiKeys();
  if (provider === "chatgpt") return keys.openai;
  if (provider === "gemini") return keys.gemini;
  return "";
}
