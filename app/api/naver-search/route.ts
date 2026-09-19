import { NextRequest, NextResponse } from "next/server";

// GET /api/naver-search?query=금니 매입&display=5
// 네이버 Open API (블로그 검색). 키 없으면 { error: "no_key" }.
// 키 발급: developers.naver.com → 내 애플리케이션 → 검색 API → ID/키를 env에 등록
// (NAVER_CLIENT_ID, NAVER_CLIENT_SECRET)
const strip = (s: unknown) => String(s ?? "").replace(/<\/?b>/g, "");

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const query = (sp.get("query") ?? "").trim();
  const display = Math.min(10, Math.max(1, Number(sp.get("display") ?? 5) || 5));
  if (!query) return NextResponse.json({ error: "query required" }, { status: 400 });
  const id = process.env.NAVER_CLIENT_ID || "";
  const secret = process.env.NAVER_CLIENT_SECRET || "";
  if (!id || !secret) return NextResponse.json({ error: "no_key" }, { status: 428 });
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(
      `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(query)}&display=${display}&sort=sim`,
      { signal: ctl.signal, headers: { "X-Naver-Client-Id": id, "X-Naver-Client-Secret": secret }, cache: "no-store" }
    );
    if (!r.ok) throw new Error(`naver ${r.status}`);
    const j = await r.json();
    const items = ((j.items ?? []) as Record<string, unknown>[]).map((it) => ({
      title: strip(it.title),
      link: String(it.link ?? ""),
      blogger: strip(it.bloggername),
      description: strip(it.description),
      postdate: String(it.postdate ?? "")
    }));
    return NextResponse.json({ items, demo: false });
  } catch (e) {
    console.error("[naver-search]", e);
    return NextResponse.json({ error: "naver_failed" }, { status: 502 });
  } finally {
    clearTimeout(t);
  }
}
