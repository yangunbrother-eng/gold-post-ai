import { NextRequest, NextResponse } from "next/server";
import { searchGoldTopics, SortMode } from "@/services/youtube";
import { MOCK_VIDEOS } from "@/lib/trends";

// GET /api/youtube/search?keywords=금값,돌반지&days=30&sort=views
// API Key 미설정 시 Mock 반환 (demo:true)
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const keywords = (sp.get("keywords") ?? "금값,금시세").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 2);
  const days = Number(sp.get("days") ?? 30);
  if (!Number.isFinite(days) || days < 1 || days > 3650 || !keywords.length || keywords.some(k => k.length > 100)) {
    return NextResponse.json({ message: "검색어와 검색 기간을 확인해 주세요." }, { status: 400 });
  }
  const sort = (sp.get("sort") ?? "views") as SortMode;

  if (!process.env.YOUTUBE_API_KEY) {
    const cutoff = Date.now() - days * 864e5;
    const videos = MOCK_VIDEOS.filter((v) => new Date(v.publishedAt).getTime() >= cutoff);
    return NextResponse.json({ videos: videos.length ? videos : MOCK_VIDEOS, demo: true });
  }
  try {
    const r = await searchGoldTopics({ keywords, days, sort });
    if (!r.videos.length) return NextResponse.json({ videos: MOCK_VIDEOS, demo: true });
    return NextResponse.json(r);
  } catch {
    return NextResponse.json({ videos: MOCK_VIDEOS, demo: true });
  }
}
