import { NextResponse } from "next/server";
import { MOCK_VIDEOS, buildCarrotTitles } from "@/lib/trends";

// 매일 오전 9시 자동 실행용 스텁 (Vercel Cron / 외부 스케줄러에서 호출).
///app/api/trends/daily — GET 호출 시 오늘 추천 5개 반환. Supabase content_schedule에 저장하도록 확장 가능.
export async function GET() {
  const titles = buildCarrotTitles(MOCK_VIDEOS, [], 5).map((t) => ({
    title: t.title,
    topic: t.pattern,
    recommend: t.scores.recommend
  }));
  return NextResponse.json({ date: new Date().toISOString().slice(0, 10), picks: titles, demo: !process.env.YOUTUBE_API_KEY });
}
