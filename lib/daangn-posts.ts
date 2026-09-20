export type DaangnPost = {
  url: string; title: string; shop: string; views: number; interest: number;
  comments: number; createdAt: string; checkedAt: string; thumbnail: string; saved?: boolean;
};

function isPost(value: unknown): value is DaangnPost {
  if (!value || typeof value !== "object") return false;
  const p = value as DaangnPost;
  return [p.title, p.shop, p.thumbnail].every(v => typeof v === "string") &&
    typeof p.url === "string" && p.url.startsWith("https://www.daangn.com/kr/business-post/") &&
    [p.views, p.interest, p.comments].every(v => Number.isFinite(v) && v >= 0) &&
    Number.isFinite(Date.parse(p.createdAt)) && Number.isFinite(Date.parse(p.checkedAt));
}

// Prefer the newest observation, regardless of which response arrives last.
export function mergeDaangnPosts(previous: DaangnPost[], incoming: unknown): DaangnPost[] {
  const merged = new Map(previous.map(p => [p.url, p]));
  if (Array.isArray(incoming)) for (const p of incoming) {
    if (!isPost(p)) continue;
    const old = merged.get(p.url);
    if (!old || Date.parse(p.checkedAt) > Date.parse(old.checkedAt) ||
      (p.checkedAt === old.checkedAt && old.saved && !p.saved)) merged.set(p.url, p);
  }
  return Array.from(merged.values());
}
