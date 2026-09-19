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
  priceDate?: string;
  rows: GoldRow[];
  cached?: boolean;
  stale?: boolean;
};

const SOURCE_URL = "https://www.koreagoldx.co.kr/price/gold";
const CHART_ENDPOINTS = [
  "https://koreagoldx.co.kr/api/price/chart/list",
  "https://www.koreagoldx.co.kr/api/price/chart/list",
];
const LINEUP_ENDPOINT = "https://apiserver.koreagoldx.co.kr/api/price/lineUp/list";

let cache: { at: number; data: GoldResponse } | null = null;

function numberOf(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const normalized = value.replace(/[,원%\s]/g, "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function fmtDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}.${m}.${d}`;
}

function calcChange(current: number | null, previous: number | null) {
  if (current == null || previous == null || previous === 0) return { value: null, pct: null };
  const value = current - previous;
  const pct = Math.round((value / previous) * 10000) / 100;
  return { value, pct };
}

async function postJson(url: string, body: unknown, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Accept: "application/json, text/plain, */*",
        Referer: SOURCE_URL,
        Origin: "https://www.koreagoldx.co.kr",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`${url} HTTP ${response.status}: ${text.slice(0, 120)}`);
    return JSON.parse(text) as PriceRecord;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchChartList(): Promise<PriceRecord[]> {
  const end = new Date();
  const start = new Date(Date.now() - 14 * 86400000);
  const payload = {
    srchDt: "SEARCH",
    type: "Au",
    dataDateStart: fmtDate(start),
    dataDateEnd: fmtDate(end),
  };

  let lastError: unknown = null;
  for (const url of CHART_ENDPOINTS) {
    try {
      const json = await postJson(url, payload);
      const list = json.list;
      if (Array.isArray(list) && list.length) return list as PriceRecord[];
    } catch (error) {
      lastError = error;
    }
  }

  try {
    const json = await postJson(LINEUP_ENDPOINT, {
      srchDt: "5M",
      type: "Au",
      dataDateStart: "",
      dataDateEnd: "",
    });
    const list = json.lineUpVal;
    if (Array.isArray(list) && list.length) return list as PriceRecord[];
  } catch (error) {
    lastError = error;
  }

  throw lastError ?? new Error("domestic gold list empty");
}

function makeRow(
  current: PriceRecord,
  previous: PriceRecord | undefined,
  id: string,
  name: string,
  sub: string,
  buyKey: string | null,
  sellKey: string,
  buyLabel?: string,
): GoldRow {
  const buy = buyKey ? numberOf(current[buyKey]) : null;
  const sell = numberOf(current[sellKey]);
  const previousBuy = buyKey && previous ? numberOf(previous[buyKey]) : null;
  const previousSell = previous ? numberOf(previous[sellKey]) : null;
  const buyDelta = calcChange(buy, previousBuy);
  const sellDelta = calcChange(sell, previousSell);

  return {
    id,
    name,
    sub,
    buy,
    buyLabel,
    sell,
    buyChange: buyDelta.value,
    sellChange: sellDelta.value,
    buyPct: buyDelta.pct,
    sellPct: sellDelta.pct,
  };
}

async function fetchDomesticPrice(): Promise<GoldResponse> {
  const list = await fetchChartList();
  const current = list[0] ?? {};
  const previous = list[1];

  const rows = [
    makeRow(current, previous, "24k", "순금시세", "Gold 24K · 3.75g", "s_pure", "p_pure"),
    makeRow(current, previous, "18k", "18K 금시세", "Gold 18K · 3.75g", null, "p_18k", "제품시세적용"),
    makeRow(current, previous, "14k", "14K 금시세", "Gold 14K · 3.75g", null, "p_14k", "제품시세적용"),
    makeRow(current, previous, "platinum", "백금시세", "Platinum · 3.75g", "s_white", "p_white"),
    makeRow(current, previous, "silver", "은시세", "Silver · 3.75g", "s_silver", "p_silver"),
  ];

  if (!rows[0].buy || !rows[0].sell) throw new Error("invalid pure gold fields");

  return {
    source: "한국금거래소",
    sourceUrl: SOURCE_URL,
    unit: "3.75g / 1돈",
    fetchedAt: new Date().toISOString(),
    priceDate: String(current.date ?? ""),
    rows,
  };
}

export async function GET() {
  try {
    if (cache && Date.now() - cache.at < 60_000) {
      return NextResponse.json({ ...cache.data, cached: true }, {
        headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=300" },
      });
    }

    const data = await fetchDomesticPrice();
    cache = { at: Date.now(), data };

    return NextResponse.json(data, {
      headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (error) {
    console.error("[gold-price:korea]", error);
    if (cache) return NextResponse.json({ ...cache.data, cached: true, stale: true });
    return NextResponse.json({ error: "domestic_gold_failed" }, { status: 502 });
  }
}
