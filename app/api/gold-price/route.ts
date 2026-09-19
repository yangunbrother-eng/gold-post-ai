import { NextResponse } from "next/server";

// GET /api/gold-price — 키 없이 실시간 금 시세 (xaus.com 무료 API)
// { krwPerGram, usdPerOz, changePct, updatedAt, source } 또는 { error }
// 60초 메모리 캐시 (무료 API 예의상)

let cache: { at: number; data: Record<string, unknown> } | null = null;

async function fetchJson(url: string, ms: number) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(`gold ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

export async function GET() {
  try {
    if (cache && Date.now() - cache.at < 60_000) {
      return NextResponse.json({ ...cache.data, cached: true });
    }
    const spot = await fetchJson("https://xaus.com/api/v1/spot?currency=KRW&unit=gram", 15000);
    const krwPerGram = Math.round(Number(spot?.xau?.price ?? 0));
    const usdPerOz = Number(spot?.spot_usd_oz ?? 0);
    if (!krwPerGram || !usdPerOz) throw new Error("bad fields");

    // 전일 대비: 일봉 히스토리 마지막 2개 종가 비교
    let changePct: number | null = null;
    try {
      const hist = await fetchJson("https://xaus.com/api/v1/history", 15000);
      const pts: unknown = hist?.points ?? hist?.closes;
      const closes: number[] = Array.isArray(pts)
        ? pts.map((c: { close?: number; c?: number } | number) => (typeof c === "number" ? c : Number(c?.c ?? c?.close ?? 0))).filter((n: number) => n > 0)
        : [];
      if (closes.length >= 2) {
        const prev = closes[closes.length - 2];
        const last = closes[closes.length - 1];
        changePct = Math.round(((last - prev) / prev) * 1000) / 10;
      }
    } catch { /* 전일비는 옵션 */ }

    const data = {
      krwPerGram,
      usdPerOz: Math.round(usdPerOz * 10) / 10,
      changePct,
      updatedAt: String(spot?.updated_at ?? new Date().toISOString()),
      source: "xaus.com",
    };
    cache = { at: Date.now(), data };
    return NextResponse.json(data);
  } catch (e) {
    console.error("[gold-price]", e);
    if (cache) return NextResponse.json({ ...cache.data, cached: true, stale: true });
    return NextResponse.json({ error: "gold_failed" }, { status: 502 });
  }
}
