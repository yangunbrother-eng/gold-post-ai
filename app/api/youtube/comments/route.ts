import { NextRequest, NextResponse } from "next/server";
import { fetchComments } from "@/services/youtube";
import { MOCK_COMMENTS } from "@/lib/trends";

// GET /api/youtube/comments?videoId=xxx
// 댓글 비허용 영상은 { disabled: true }, API 미연결 시 Mock (demo:true)
export async function GET(req: NextRequest) {
  const videoId = req.nextUrl.searchParams.get("videoId") ?? "";
  if (!videoId) return NextResponse.json({ comments: [], demo: true });
  if (!process.env.YOUTUBE_API_KEY) {
    return NextResponse.json({ comments: MOCK_COMMENTS, demo: true });
  }
  try {
    const r = await fetchComments(videoId, 40);
    if (r.disabled) return NextResponse.json({ comments: [], demo: false, disabled: true });
    if (!r.comments.length) return NextResponse.json({ comments: MOCK_COMMENTS, demo: true });
    return NextResponse.json(r);
  } catch {
    return NextResponse.json({ comments: MOCK_COMMENTS, demo: true });
  }
}
