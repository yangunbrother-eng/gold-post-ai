import { NextResponse } from "next/server";

type PriceRecord = Record<string, unknown>;
type GoldRow = {
  id: string;
  name: string;
  sub: string;
  buy: number | null;
  buyLabel?: string;
  sell: number | null;
  buyChange: number | null;
  sellChange: number | null;
  buyPct: number | null;
  sellPct: number | null;
};
type GoldResponse = {
  source: string;
  sourceUrl: string;
  unit: string;
  fetchedAt: string;
  rows: GoldRow[];
  cached?: boolean;
  stale?: boolean;
};

const SOURCE_URL = "https://www.koreagoldx.co.kr/price/gold";
const API_URL = "https://www.koreagoldx.co.kr/api/main";
let cache: { at: number; data: GoldResponse } | null = null;

function numberOf(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const normalized = value.replace(/[,원%\s]/g, "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function row(
  p: PriceRecord,
  id: string,
  name: string,
  sub: string,
  buyKey: string | null,
  sellKey: string,
  buyChangeKey: string | null,
  sellChangeKey: string,
  buyPctKey: string | null,
  sellPctKey: string,
  buyLabel?: string,
): GoldRow {
  return {
    id, name, sub,
    buy: buyKey ? numberOf(p[buyKey]) : null,
    buyLabel,
    sell: numberOf(p[sellKey]),
    buyChange: buyChangeKey ? numberOf(p[buyChangeKey]) : null,
    sellChange: numberOf(p[sellChangeKey]),
    buyPct: buyPctKey ? numberOf(p[buyPctKey]) : null,
    sellPct: numberOf(p[sellPctKey]),
  };
}

async function fetchDomesticPrice(): Promise<GoldResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(API_URL, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json, text/plain, */*",
        Referer: "https://www.koreagoldx.co.kr/",
        Origin: "https://www.koreagoldx.co.kr",
        "User-Agent": "Mozilla/5.0 (compatible; GoldPostAI/1.0)",
      },
    });
    if (!response.ok) throw new Error(`koreagoldx ${response.status}`);
    const root = await response.json() as PriceRecord;
    const nested = root.data && typeof root.data === "object" ? root.data as PriceRecord : null;
    const prices = (root.officialPrice4 ?? nested?.officialPrice4) as PriceRecord | undefined;
    if (!prices || typeof prices !== "object") throw new Error("officialPrice4 missing");

    const rows: GoldRow[] = [
      row(prices, "24k", "순금시세", "Gold 24K · 3.75g", "s_pure", "p_pure", "turm_s_pure", "turm_p_pure", "per_s_pure", "per_p_pure"),
      row(prices, "18k", "18K 금시세", "Gold 18K · 3.75g", null, "p_18k", null, "turm_p_18k", null, "per_p_18k", "제품시세적용"),
      row(prices, "14k", "14K 금시세", "Gold 14K · 3.75g", null, "p_14k", null, "turm_p_14k", null, "per_p_14k", "제품시세적용"),
      row(prices, "platinum", "백금시세", "Platinum · 3.75g", "s_white", "p_white", "turm_s_white", "turm_p_white", "per_s_white", "per_p_white"),
      row(prices, "silver", "은시세", "Silver · 3.75g", "s_silver", "p_silver", "turm_s_silver", "turm_p_silver", "per_s_silver", "per_p_silver"),
    ];

    if (!rows[0].buy || !rows[0].sell) throw new Error("invalid pure gold fields");
    return {
      source: "한국금거래소",
      sourceUrl: SOURCE_URL,
      unit: "3.75g / 1돈",
      fetchedAt: new Date().toISOString(),
      rows,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  try {
    if (cache && Date.now() - cache.at < 60_000) {
      return NextResponse.json({ ...cache.data, cached: true }, { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=300" } });
    }
    const data = await fetchDomesticPrice();
    cache = { at: Date.now(), data };
    return NextResponse.json(data, { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=300" } });
  } catch (error) {
    console.error("[gold-price:korea]", error);
    if (cache) return NextResponse.json({ ...cache.data, cached: true, stale: true });
    return NextResponse.json({ error: "domestic_gold_failed" }, { status: 502 });
  }
}
