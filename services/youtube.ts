// 서버 전용 YouTube Data API 클라이언트.
// API Key를 프론트에 노출하지 않는다 — 항상 서버 route에서만 import할 것.
// 환경변수: YOUTUBE_API_KEY (없으면 호출자가 Mock으로 폴백)
import { TrendVideo, YTComment } from "@/lib/trends";

interface YTSearchItem {
  id: { videoId?: string };
  snippet: { title: string; channelTitle: string; publishedAt: string };
}
interface YTVideoItem {
  id: string;
  snippet: { title: string; channelTitle: string; publishedAt: string };
  statistics: { viewCount?: string; likeCount?: string; commentCount?: string };
}

export type SortMode = "views" | "recent" | "engaged" | "rising";

export async function searchGoldTopics(opts: {
  keywords: string[];
  days: number;
  sort: SortMode;
  maxPerKeyword?: number;
}): Promise<{ videos: TrendVideo[]; demo: boolean }> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return { videos: [], demo: true };

  const { keywords, days, maxPerKeyword = 5 } = opts;
  const publishedAfter = new Date(Date.now() - days * 864e5).toISOString();
  const order = opts.sort === "recent" ? "date" : opts.sort === "views" ? "viewCount" : "relevance";

  const all: TrendVideo[] = [];
  for (const kw of keywords.slice(0, 6)) {
    try {
      const sRes = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${maxPerKeyword}&order=${order}&publishedAfter=${publishedAfter}&q=${encodeURIComponent(kw + " 금")}&key=${key}`,
        { next: { revalidate: 3600 } }
      );
      if (!sRes.ok) continue;
      const sJson = await sRes.json();
      const ids: string[] = (sJson.items as YTSearchItem[] ?? []).map((i) => i.id.videoId).filter(Boolean) as string[];
      if (!ids.length) continue;
      const vRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${ids.join(",")}&key=${key}`,
        { next: { revalidate: 3600 } }
      );
      if (!vRes.ok) continue;
      const vJson = await vRes.json();
      for (const v of (vJson.items as YTVideoItem[] ?? [])) {
        all.push({
          videoId: v.id,
          title: v.snippet.title,
          channel: v.snippet.channelTitle,
          publishedAt: v.snippet.publishedAt.slice(0, 10),
          views: Number(v.statistics.viewCount ?? 0),
          likes: Number(v.statistics.likeCount ?? 0),
          comments: Number(v.statistics.commentCount ?? 0),
          url: `https://www.youtube.com/watch?v=${v.id}`,
          keyword: kw
        });
      }
    } catch { /* 키워드 하나 실패해도 계속 */ }
  }

  // dedup
  const seen = new Set<string>();
  const deduped = all.filter((v) => (seen.has(v.videoId) ? false : (seen.add(v.videoId), true)));
  return { videos: deduped, demo: false };
}

// 영상 댓글 수집 (commentThreads.list = 1 unit, 저렴)
// 댓글 비허용 영상은 { disabled: true } 반환
export async function fetchComments(videoId: string, max = 40): Promise<{ comments: YTComment[]; demo: boolean; disabled?: boolean }> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return { comments: [], demo: true };
  try {
    const r = await fetch(
      `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&maxResults=${Math.min(100, max)}&orderBy=relevance&textFormat=plainText&key=${key}`,
      { next: { revalidate: 3600 } }
    );
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const reason = j?.error?.errors?.[0]?.reason ?? "";
      if (reason === "commentsDisabled") return { comments: [], demo: false, disabled: true };
      return { comments: [], demo: true };
    }
    const comments: YTComment[] = (j.items ?? []).map((it: any) => ({
      author: it.snippet?.topLevelComment?.snippet?.authorDisplayName ?? "익명",
      text: String(it.snippet?.topLevelComment?.snippet?.textDisplay ?? "").slice(0, 300),
      likes: Number(it.snippet?.topLevelComment?.snippet?.likeCount ?? 0),
      publishedAt: String(it.snippet?.topLevelComment?.snippet?.publishedAt ?? "").slice(0, 10)
    })).filter((c: YTComment) => c.text);
    if (!comments.length) return { comments: [], demo: true };
    return { comments, demo: false };
  } catch {
    return { comments: [], demo: true };
  }
}
