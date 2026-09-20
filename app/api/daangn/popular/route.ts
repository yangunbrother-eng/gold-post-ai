import { NextResponse } from "next/server";
import { GOLD_PROFILES } from "@/lib/daangn-profiles";
import snapshot from "@/lib/daangn-snapshot.json";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
async function read(path: string, fresh = false) {
  if (!path.startsWith("/kr/local-profile/") && !path.startsWith("/kr/business-post/")) throw new Error("Invalid path");
  const response = await fetch(`https://www.daangn.com${path}`, { ...(fresh ? { cache: "no-store" as const } : { next: { revalidate: 21600 } }), signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("Source unavailable");
  const match = (await response.text()).match(/window\.__remixContext = ([\s\S]*?);<\/script>/);
  if (!match) throw new Error("Page format changed");
  return Object.values(JSON.parse(match[1]).state.loaderData) as any[];
}
export async function GET(request: Request) {
  const fresh = new URL(request.url).searchParams.get("refresh") === "1";
  const profiles = GOLD_PROFILES;
  const rawOffset = Number(new URL(request.url).searchParams.get("offset") || 0);
  if (!Number.isSafeInteger(rawOffset) || rawOffset < 0 || rawOffset > profiles.length) {
    return NextResponse.json({ message: "잘못된 수집 위치입니다." }, { status: 400 });
  }
  const offset = rawOffset;
  const selected = profiles.slice(offset, offset + 5);
  const batches = await Promise.allSettled(selected.map(async slug => {
    const profile = (await read(`/kr/local-profile/${slug}/`, fresh)).find(x => x?.localProfile)?.localProfile;
    const posts = await Promise.allSettled((profile?.bizPosts ?? []).map(async (item: any) => {
      const p = (await read(item.id, fresh)).find(x => x?.businessPost)?.businessPost;
      if (!p || !Number.isFinite(p.counter?.viewCount)) throw new Error("Missing views");
      return { title: String(p.title), url: `https://www.daangn.com${item.id}`, views: p.counter.viewCount, interest: p.counter.bookmarkCount ?? 0, comments: p.counter.commentCount ?? 0, createdAt: p.createdAt, thumbnail: p.images?.[0]?.thumbnailUrl ?? "", checkedAt: new Date().toISOString(), shop: (profile?.name || slug.replace(/-[a-z0-9]+$/, "").replaceAll("-", " ")) };
    }));
    return posts.flatMap((p: any) => p.status === "fulfilled" ? [p.value] : []);
  }));
  const live = batches.flatMap(b => b.status === "fulfilled" ? b.value : []);
  const merged = new Map(snapshot.map(p => [p.url, { ...p, saved: true }]));
  for (const p of live) merged.set(p.url, { ...p, saved: false });
  // Refresh clients already retain the saved list: only send this batch's updates.
  const posts = fresh ? live.map(p => ({ ...p, saved: false })) : Array.from(merged.values());
  return NextResponse.json({ collectedCount: live.length, sourceCount: selected.length, totalSources: profiles.length, nextOffset: offset + 5 < profiles.length ? offset + 5 : null, posts: posts.sort((a, b) => b.views - a.views) });
}
