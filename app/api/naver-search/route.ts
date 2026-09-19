import { NextRequest, NextResponse } from "next/server";

// GET /api/naver-search?query=금니 매입&display=5
// NAVER API HUB (NCP) 블로그+카페글 검색. 키 없으면 { error: "no_key" }.
// 키 발급: 네이버 클라우드 콘솔 → NAVER API HUB → Application 등록 → ID/키를 env에 등록
// (NAVER_CLIENT_ID, NAVER_CLIENT_SECRET)
const NCP = "https://naverapihub.apigw.ntruss.com";
const strip = (s: unknown) => String(s ?? "").replace(/<\/?b>/g, "").replace(/&lt;\/?b&gt;/g, "");

type Item = { title: string; link: string; blogger: string; description: string; postdate: string; kind: string };

async function searchKind(
  kind: "blog" | "cafearticle", query: string, display: number,
  id: string, secret: string, signal: AbortSignal
): Promise<Item[]> {
  const r = await fetch(
    `${NCP}/search/v1/${kind}?query=${encodeURIComponent(query)}&display=${display}&sort=sim&format=json`,
    {
      signal,
      headers: { "X-NCP-APIGW-API-KEY-ID": id, "X-NCP-APIGW-API-KEY": secret },
      cache: "no-store"
    }
  );
  if (!r.ok) throw new Error(`${kind} ${r.status}`);
  const j = await r.json();
  return ((j.items ?? []) as Record<string, unknown>[]).map((it) => ({
    title: strip(it.title),
    link: String(it.link ?? ""),
    blogger: strip(it.bloggername),
    description: strip(it.description),
    postdate: String(it.postdate ?? ""),
    kind
  }));
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const query = (sp.get("query") ?? "").trim();
  const display = Math.min(10, Math.max(1, Number(sp.get("display") ?? 5) || 5));
  if (!query) return NextResponse.json({ error: "query required" }, { status: 400 });
  const id = process.env.NAVER_CLIENT_ID || "";
  const secret = process.env.NAVER_CLIENT_SECRET || "";
  if (!id || !secret) return NextResponse.json({ error: "no_key" }, { status: 428 });
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20000);
  try {
    const [blogs, cafes] = await Promise.all([
      searchKind("blog", query, display, id, secret, ctl.signal).catch(() => [] as Item[]),
      searchKind("cafearticle", query, display, id, secret, ctl.signal).catch(() => [] as Item[])
    ]);
    const items: Item[] = [];
    const n = Math.max(blogs.length, cafes.length);
    for (let i = 0; i < n && items.length < display * 2; i++) {
      if (blogs[i]) items.push(blogs[i]);
      if (cafes[i] && items.length < display * 2) items.push(cafes[i]);
    }
    return NextResponse.json({ items, demo: false });
  } catch (e) {
    console.error("[naver-search]", e);
    return NextResponse.json({ error: "naver_failed" }, { status: 502 });
  } finally {
    clearTimeout(t);
  }
}
