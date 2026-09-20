import TrendsClient from "./TrendsClient";
import { searchGoldTopics, fetchComments } from "@/services/youtube";
export const dynamic = "force-dynamic";
export default async function TrendsPage() {
  const result = await searchGoldTopics({ keywords: ["금값", "금시세"], days: 30, sort: "views" });
  const entries = await Promise.all(result.videos.map(async video => [video.videoId, await fetchComments(video.videoId)] as const));
  return <TrendsClient initialVideos={result.videos} initialComments={Object.fromEntries(entries)} />;
}
