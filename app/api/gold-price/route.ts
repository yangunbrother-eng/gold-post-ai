import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

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
const PUBLIC_FALLBACK_URL = "https://anseonggold.co.kr/gold-price";
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
    id, name, sub, buy, buyLabel, sell,
    buyChange: buyDelta.value,
    sellChange: sellDelta.value,
    buyPct: buyDelta.pct,
    sellPct: sellDelta.pct,
  };
}

async function fetchOfficialApi(): Promise<GoldResponse> {
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

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function pair(text: string, pattern: RegExp): [number, number] | null {
  const m = text.match(pattern);
  if (!m) return null;
  const buy = numberOf(m[1]);
  const sell = numberOf(m[2]);
  return buy != null && sell != null ? [buy, sell] : null;
}

async function fetchPublicDomesticFallback(): Promise<GoldResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(PUBLIC_FALLBACK_URL, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0 (compatible; GoldPostAI/1.0)",
      },
    });
    if (!response.ok) throw new Error(`fallback HTTP ${response.status}`);
    const text = stripHtml(await response.text());

    const pure = pair(text, /순금\s*24K\s*([0-9,]+)원\s*([0-9,]+)원/i);
    const k18 = pair(text, /18K\s*([0-9,]+)원\s*([0-9,]+)원/i);
    const k14 = pair(text, /14K\s*([0-9,]+)원\s*([0-9,]+)원/i);
    const pt = pair(text, /백금\s*\(?Pt\)?\s*([0-9,]+)원\s*([0-9,]+)원/i);
    const ag = pair(text, /은\s*\(?Ag\)?\s*([0-9,]+)원\s*([0-9,]+)원/i);
    const date = text.match(/기준\s*[:：]?\s*(20\d{2}[-.]\d{2}[-.]\d{2}(?:\s+\d{2}:\d{2})?)/)?.[1] ?? "";

    if (!pure || !k18 || !k14 || !pt || !ag) throw new Error("fallback table parse failed");

    const rows: GoldRow[] = [
      { id:"24k", name:"순금시세", sub:"Gold 24K · 3.75g", buy:pure[0], sell:pure[1], buyChange:null, sellChange:null, buyPct:null, sellPct:null },
      { id:"18k", name:"18K 금시세", sub:"Gold 18K · 3.75g", buy:null, buyLabel:"제품시세적용", sell:k18[1], buyChange:null, sellChange:null, buyPct:null, sellPct:null },
      { id:"14k", name:"14K 금시세", sub:"Gold 14K · 3.75g", buy:null, buyLabel:"제품시세적용", sell:k14[1], buyChange:null, sellChange:null, buyPct:null, sellPct:null },
      { id:"platinum", name:"백금시세", sub:"Platinum · 3.75g", buy:pt[0], sell:pt[1], buyChange:null, sellChange:null, buyPct:null, sellPct:null },
      { id:"silver", name:"은시세", sub:"Silver · 3.75g", buy:ag[0], sell:ag[1], buyChange:null, sellChange:null, buyPct:null, sellPct:null },
    ];

    return {
      source: "한국금거래소 공식 고시가 · 안성공도점 공개 시세",
      sourceUrl: PUBLIC_FALLBACK_URL,
      unit: "3.75g / 1돈",
      fetchedAt: new Date().toISOString(),
      priceDate: date,
      rows,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchIntlEstimate(): Promise<GoldResponse> {
  // 해외 서버에서도 막히지 않는 무료 소스: 국제 금 현물 × 달러환율 → 1돈 환산 추정치
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 12000);
  try {
    const [g, f] = await Promise.all([
      fetch("https://api.gold-api.com/price/XAU", { cache: "no-store", signal: ctl.signal }).then((r) => { if (!r.ok) throw new Error("xau"); return r.json(); }),
      fetch("https://open.er-api.com/v6/latest/USD", { cache: "no-store", signal: ctl.signal }).then((r) => { if (!r.ok) throw new Error("fx"); return r.json(); })
    ]);
    const xau = Number(g.price);
    const krw = Number(f.rates?.KRW);
    if (!xau || !krw) throw new Error("intl parse failed");
    const perDon = (xau / 31.1034768) * 3.75 * krw; // 순금 1돈 추정치
    const r10 = (n: number) => Math.round(n / 10) * 10;
    const kst = new Date(new Date(g.updatedAt ?? Date.now()).getTime() + 9 * 3600_000);
    const priceDate = `${kst.getUTCFullYear()}.${String(kst.getUTCMonth() + 1).padStart(2, "0")}.${String(kst.getUTCDate()).padStart(2, "0")}`;
    const rows: GoldRow[] = [
      { id: "24k", name: "순금시세", sub: "Gold 24K · 3.75g", buy: r10(perDon * 1.1), sell: r10(perDon), buyChange: null, sellChange: null, buyPct: null, sellPct: null },
      { id: "18k", name: "18K 금시세", sub: "Gold 18K · 3.75g", buy: null, buyLabel: "제품시세적용", sell: r10(perDon * 0.75), buyChange: null, sellChange: null, buyPct: null, sellPct: null },
      { id: "14k", name: "14K 금시세", sub: "Gold 14K · 3.75g", buy: null, buyLabel: "제품시세적용", sell: r10(perDon * 0.585), buyChange: null, sellChange: null, buyPct: null, sellPct: null },
      { id: "platinum", name: "백금시세", sub: "Platinum · 3.75g", buy: null, buyLabel: "추정치 미제공", sell: null, buyChange: null, sellChange: null, buyPct: null, sellPct: null },
      { id: "silver", name: "은시세", sub: "Silver · 3.75g", buy: null, buyLabel: "추정치 미제공", sell: null, buyChange: null, sellChange: null, buyPct: null, sellPct: null },
    ];
    return {
      source: "국제시세 환산 추정치 (VAT·공임 제외)",
      sourceUrl: "https://api.gold-api.com/price/XAU",
      unit: "3.75g / 1돈",
      fetchedAt: new Date().toISOString(),
      priceDate,
      rows,
    };
  } finally {
    clearTimeout(t);
  }
}

async function fetchDomesticPrice(): Promise<GoldResponse> {
  try {
    return await fetchOfficialApi();
  } catch (officialError) {
    console.warn("[gold-price] official API failed, trying public domestic fallback", officialError);
    try {
      return await fetchPublicDomesticFallback();
    } catch (fallbackError) {
      console.warn("[gold-price] domestic fallback failed, trying intl estimate", fallbackError);
      return await fetchIntlEstimate();
    }
  }
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
