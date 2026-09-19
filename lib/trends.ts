import { ContentItem } from "./types";

// ── 유튜브 영상 데이터 (API 스키마와 1:1, Mock도 동일 구조) ──
export interface TrendVideo {
  videoId: string;
  title: string;
  channel: string;
  publishedAt: string; // YYYY-MM-DD
  views: number;
  likes: number;
  comments: number;
  url: string;
  keyword: string; // 어떤 검색 키워드로 수집됐는지
}

export interface VideoMetrics extends TrendVideo {
  daysSince: number;
  viewVelocity: number; // 조회수 / 경과일
  likeRate: number;     // 좋아요 / 조회수
  commentRate: number;  // 댓글 / 조회수
  interest: number;     // 현재 관심도 (내부 참고 점수 0~100)
}

export interface TitlePattern {
  topic: string;
  keywords: string[];
  isQuestion: boolean;
  hasNumber: boolean;
  isLossWarning: boolean; // 손해/주의형
  isPrice: boolean;       // 가격형
  isCompare: boolean;     // 비교형
  isTwist: boolean;       // 반전형
  isTiming: boolean;      // 타이밍형
  curiosity: string;      // 궁금증 유발 방식
  hook: string;           // 핵심 훅
  psychology: string;     // 고객 심리
}

export interface CarrotTitle {
  title: string;
  sourceVideoId: string;
  pattern: string;
  similarity: number; // 원본과의 유사도 (높으면 재생성됨)
  scores: { interest: number; recency: number; overlap: number; recommend: number };
}

export const DEFAULT_KEYWORDS = [
  "금값", "금시세", "금 팔때", "금매입", "금값 전망", "순금",
  "24K", "18K", "14K", "돌반지", "금목걸이", "금반지",
  "금테크", "금값 상승", "금값 하락", "금 팔기",
  "금 살때", "오래된 금", "금 감정"
];

const K_KEYS = "cpai_trend_keywords_v1";
export function loadKeywords(): string[] {
  if (typeof window === "undefined") return DEFAULT_KEYWORDS;
  try {
    const raw = localStorage.getItem(K_KEYS);
    if (raw) return JSON.parse(raw) as string[];
  } catch {}
  return DEFAULT_KEYWORDS;
}
export function saveKeywords(k: string[]) {
  try { localStorage.setItem(K_KEYS, JSON.stringify(k)); } catch {}
}

// ── 지표 계산 ──
export function daysSince(dateStr: string): number {
  const d = Math.max(1, Math.round((Date.now() - new Date(dateStr).getTime()) / 864e5));
  return d;
}

export function scoreVideo(v: TrendVideo): VideoMetrics {
  const d = daysSince(v.publishedAt);
  const velocity = v.views / d;
  const likeRate = v.views ? v.likes / v.views : 0;
  const commentRate = v.views ? v.comments / v.views : 0;
  // 현재 관심도: 속도(로그) 60% + 좋아요비율 20% + 댓글반응 20%, 0~100 정규화
  const vScore = Math.min(100, (Math.log10(velocity + 1) / 6) * 100);
  const lScore = Math.min(100, likeRate * 100 * 25);
  const cScore = Math.min(100, commentRate * 100 * 120);
  const recencyBoost = d <= 7 ? 12 : d <= 30 ? 6 : 0;
  const interest = Math.round(Math.min(100, vScore * 0.6 + lScore * 0.2 + cScore * 0.2 + recencyBoost));
  return { ...v, daysSince: d, viewVelocity: Math.round(velocity), likeRate, commentRate, interest };
}

export const fmtNum = (n: number) =>
  n >= 10000 ? `${(n / 10000).toFixed(1)}만` : n >= 1000 ? `${(n / 1000).toFixed(1)}천` : `${n}`;

// ── 제목 패턴 분석 (복사 금지, 패턴만 추출) ──
export function analyzeTitle(title: string): TitlePattern {
  const t = title;
  const isQuestion = /[?？]|까|을까|될까|할까|인가|인가요|어떻|왜|언제|어디|뭘|무엇/.test(t);
  const hasNumber = /[0-9]+/.test(t);
  const isLossWarning = /손해|주의|조심|속|사기|후회|버리|낭패|위험|함정/.test(t);
  const isPrice = /원|가격|시세|얼마|돈|만원|억/.test(t);
  const isCompare = /vs|비교|차이|14K|18K|24K|순금/.test(t) && /(차이|비교|다른|vs)/i.test(t);
  const isTwist = /반전|몰랐|사실|깜짝|충격|놀라/.test(t);
  const isTiming = /지금|오늘|역대|최고|급등|폭등|하락|이때|타이밍|시기/.test(t);

  const topic =
    /돌반지/.test(t) ? "돌반지" :
    /목걸이/.test(t) ? "금목걸이" :
    /반지/.test(t) ? "금반지" :
    /18K|14K/.test(t) ? "함량별 매입" :
    /보증서|감정/.test(t) ? "감정·보증서" :
    /금테크|투자/.test(t) ? "금테크" :
    /팔/.test(t) ? "금 매도 타이밍" :
    /살|매수/.test(t) ? "금 매수 타이밍" :
    /전망|오를|상승/.test(t) ? "금값 상승" :
    /하락|떨어/.test(t) ? "금값 하락" : "금 시세";

  const keywords = Array.from(new Set((t.match(/[가-힣]{2,}/g) ?? []).filter((w) => w.length >= 2))).slice(0, 5);
  const curiosity = isQuestion ? "질문형 궁금증" : isLossWarning ? "손실 회피 심리" : isTwist ? "반전·호기심" : isTiming ? "타이밍 조급함" : "정보 탐색 욕구";
  const hook = (t.match(/지금|오늘|역대 최고|충격|사실|손해|얼마|무료/g) ?? ["지금"])[0];
  const psychology =
    /팔/.test(t) ? "매도 타이밍 고민" :
    /살/.test(t) ? "매수 타이밍 고민" :
    isLossWarning ? "손해 볼까 봐 걱정" :
    isPrice ? "내 금의 가치 궁금" : "정확한 정보 탐색";

  return { topic, keywords, isQuestion, hasNumber, isLossWarning, isPrice, isCompare, isTwist, isTiming, curiosity, hook, psychology };
}

// 원본과 당근 제목 간 유사도 (토큰 겹침)
function titleSimilarity(a: string, b: string): number {
  const tok = (s: string) => new Set(s.replace(/[^\uac00-\ud7a3a-zA-Z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length >= 2));
  const A = tok(a), B = tok(b);
  let inter = 0;
  A.forEach((w) => { if (B.has(w)) inter++; });
  return Math.round((inter / Math.max(1, Math.min(A.size, B.size))) * 100);
}

// ── 패턴 → 당근용 새 제목 생성 (원본 그대로 사용 금지) ──
const REWRITE_TEMPLATES: { cond: (p: TitlePattern) => boolean; make: (p: TitlePattern) => string[]; label: string }[] = [
  {
    label: "질문형", cond: (p) => p.isQuestion,
    make: (p) => [
      `요즘 ${p.topic} 궁금하셨죠? 1분 정리`,
      `${p.topic}, 지금 물어봐도 될까요?`,
      `“${p.topic}” 방문 전 이것만 확인하세요`
    ]
  },
  {
    label: "손해/주의형", cond: (p) => p.isLossWarning,
    make: (p) => [
      `${p.topic} 전에 이것 하나는 확인하세요`,
      `버리기 전에 보세요 — ${p.topic} 정리`,
      `손해 보기 전에 감정부터 받아보세요`
    ]
  },
  {
    label: "가격형", cond: (p) => p.isPrice,
    make: () => [
      `우리 집 금, 지금 얼마 정도 할까요?`,
      `작은 금 조각도 돈이 될까요?`,
      `서랍 속 금, 예상가 5분 안에 알려드립니다`
    ]
  },
  {
    label: "비교형", cond: (p) => p.isCompare,
    make: () => [
      `18K와 14K, 매입 가격 차이는 얼마나 날까요?`,
      `순금 vs 18K, 우리 집 건 뭘까요?`,
      `같은 1돈인데 왜 금액이 다를까요?`
    ]
  },
  {
    label: "타이밍형", cond: (p) => p.isTiming,
    make: (p) => [
      `금값 올랐는데 지금 팔아도 괜찮을까요?`,
      `지금 금을 팔러 오는 분들이 많아진 이유`,
      `요즘 금값이 자꾸 오르는 이유는 뭘까요?`
    ]
  }
];

const FALLBACK_TITLES = [
  "금값 올랐는데 지금 팔아도 괜찮을까요?",
  "오래된 돌반지, 지금 얼마 정도 할까요?",
  "끊어진 금목걸이도 금값 받을 수 있을까요?",
  "18K와 14K, 매입 가격 차이는 얼마나 날까요?",
  "보증서 없는 금도 매입할 수 있을까요?",
  "작은 금 조각도 돈이 될까요?",
  "금 팔기 전에 이것 하나는 확인하세요",
  "요즘 금값이 자꾸 오르는 이유는 뭘까요?",
  "서랍 속 금반지, 그냥 두고 계신가요?",
  "지금 금을 팔러 오는 분들이 많아진 이유"
];

export function carrotTitleFrom(video: TrendVideo): { title: string; pattern: TitlePattern; similarity: number } {
  const p = analyzeTitle(video.title);
  const cands: { t: string; label: string }[] = [];
  for (const tpl of REWRITE_TEMPLATES) {
    if (tpl.cond(p)) tpl.make(p).forEach((t) => cands.push({ t, label: tpl.label }));
  }
  if (!cands.length) FALLBACK_TITLES.forEach((t) => cands.push({ t, label: "기본형" }));
  // 원본 유사도 60% 이상이면 탈락 → 자동 재생성
  const ok = cands.find((c) => titleSimilarity(video.title, c.t) < 60) ?? cands[0];
  return { title: ok.t, pattern: p, similarity: titleSimilarity(video.title, ok.t) };
}

// ── 내부 발행 이력 기반 중복 페널티 ──
export function overlapScore(topic: string, recent: ContentItem[]): number {
  if (!recent.length) return 0;
  const core = topic.replace(/ /g, "");
  let hit = 0;
  for (const r of recent) {
    const hay = (r.title + " " + r.body).replace(/ /g, "");
    if (hay.includes(core.slice(0, 3)) || core.slice(0, 3).includes(hay.slice(0, 3))) hit++;
    if ((r.title + r.body).includes(topic)) hit += 2;
  }
  return Math.min(100, hit * 22);
}

// ── 최종 추천 점수 (내부 선별용, 성과 예측 아님) ──
export function recommendScore(m: VideoMetrics, recent: ContentItem[]): CarrotTitle["scores"] {
  const interest = m.interest;
  const recency = m.daysSince <= 7 ? 92 : m.daysSince <= 30 ? 75 : 50;
  const pattern = analyzeTitle(m.title);
  const overlap = overlapScore(pattern.topic, recent.slice(0, 20));
  const recommend = Math.round(Math.min(100, interest * 0.5 + recency * 0.35 + (100 - overlap) * 0.15));
  return { interest, recency, overlap, recommend };
}

export function buildCarrotTitles(videos: TrendVideo[], recent: ContentItem[], n = 10): CarrotTitle[] {
  const scored = videos.map((v) => scoreVideo(v)).sort((a, b) => b.interest - a.interest);
  const out: CarrotTitle[] = [];
  const used = new Set<string>();
  for (const m of scored) {
    if (out.length >= n) break;
    const { title, pattern, similarity } = carrotTitleFrom(m);
    if (used.has(title)) continue; // 중복 제거
    used.add(title);
    out.push({ title, sourceVideoId: m.videoId, pattern: pattern.topic, similarity, scores: recommendScore(m, recent) });
  }
  // 부족하면 폴백으로 채움 (중복 제거 유지)
  for (const f of FALLBACK_TITLES) {
    if (out.length >= n) break;
    if (used.has(f)) continue;
    used.add(f);
    out.push({ title: f, sourceVideoId: scored[0]?.videoId ?? "demo", pattern: "트렌드 종합", similarity: 0, scores: { interest: 70, recency: 80, overlap: 10, recommend: 78 } });
  }
  return out.sort((a, b) => b.scores.recommend - a.scores.recommend);
}

// ── Mock 데이터 (API 미연결 시 사용, 스키마 동일) ──
const ago = (d: number) => { const t = new Date(); t.setDate(t.getDate() - d); return t.toISOString().slice(0, 10); };

export const MOCK_VIDEOS: TrendVideo[] = [
  { videoId: "au1", title: "금값 역대 최고인데 지금 팔아야 할까?", channel: "금테크연구소", publishedAt: ago(3), views: 32000, likes: 1200, comments: 210, url: "https://www.youtube.com/watch?v=au1", keyword: "금값" },
  { videoId: "au2", title: "돌반지 하나에 얼마? 2026년 최신 시세 정리", channel: "우리동네 금이야기", publishedAt: ago(5), views: 48000, likes: 900, comments: 130, url: "https://www.youtube.com/watch?v=au2", keyword: "돌반지" },
  { videoId: "au3", title: "끊어진 금목걸이 버리지 마세요! 손해 보는 이유", channel: "절약금고", publishedAt: ago(2), views: 21000, likes: 1500, comments: 320, url: "https://www.youtube.com/watch?v=au3", keyword: "금목걸이" },
  { videoId: "au4", title: "18K vs 14K 가격 차이 충격적입니다", channel: "귀금속팩트", publishedAt: ago(9), views: 95000, likes: 2100, comments: 280, url: "https://www.youtube.com/watch?v=au4", keyword: "18K" },
  { videoId: "au5", title: "보증서 없는 금, 매입 거절당하는 진짜 이유", channel: "금감정사브리핑", publishedAt: ago(6), views: 27000, likes: 800, comments: 190, url: "https://www.youtube.com/watch?v=au5", keyword: "금 감정" },
  { videoId: "au6", title: "금값이 자꾸 오르는 이유 3가지 (2026 전망)", channel: "경제읽기", publishedAt: ago(4), views: 120000, likes: 3400, comments: 410, url: "https://www.youtube.com/watch?v=au6", keyword: "금값 전망" },
  { videoId: "au7", title: "오래된 금반지, 그냥 두면 손해? 사실 확인", channel: "살림금통", publishedAt: ago(12), views: 150000, likes: 2200, comments: 180, url: "https://www.youtube.com/watch?v=au7", keyword: "금반지" },
  { videoId: "au8", title: "금 살때 vs 팔때, 금액이 다른 충격 이유", channel: "금테크연구소", publishedAt: ago(1), views: 9500, likes: 700, comments: 150, url: "https://www.youtube.com/watch?v=au8", keyword: "금 살때" },
  { videoId: "au9", title: "순금 1돈, 오늘 얼마? 매일 바뀌는 시세 보는 법", channel: "시세알리미", publishedAt: ago(2), views: 18000, likes: 500, comments: 90, url: "https://www.youtube.com/watch?v=au9", keyword: "순금" },
  { videoId: "au10", title: "작은 금 조각도 돈이 됩니다 (실제 감정 영상)", channel: "우리동네 금이야기", publishedAt: ago(8), views: 56000, likes: 1900, comments: 260, url: "https://www.youtube.com/watch?v=au10", keyword: "오래된 금" },
  { videoId: "au11", title: "금 팔기 전 이것 하나는 꼭 확인하세요", channel: "귀금속팩트", publishedAt: ago(15), views: 210000, likes: 4100, comments: 350, url: "https://www.youtube.com/watch?v=au11", keyword: "금 팔기" },
  { videoId: "au12", title: "24K와 18K, 매입가가 다른 진짜 이유", channel: "금감정사브리핑", publishedAt: ago(20), views: 88000, likes: 1100, comments: 120, url: "https://www.youtube.com/watch?v=au12", keyword: "24K" }
];

export const TREND_TOPICS = ["금값 상승", "돌반지", "지금 팔아야 하나", "18K 매입", "금테크"];

// ── 댓글 분석 → 콘텐츠 아이디어 ──
export interface YTComment {
  author: string;
  text: string;
  likes: number;
  publishedAt: string;
}

export const MOCK_COMMENTS: YTComment[] = [
  { author: "제주맘", text: "금이빨도 매입이 되나요? 치과에서 받아온 건데 양이 얼마 안 돼서요", likes: 24, publishedAt: ago(1) },
  { author: "서랍정리중", text: "끊어진 목걸이에 이물질도 묻어있는데 이런 것도 가격 쳐주나요?", likes: 18, publishedAt: ago(2) },
  { author: "궁금한이웃", text: "18K랑 14K 가격 차이가 얼마나 나나요?", likes: 31, publishedAt: ago(1) },
  { author: "돌반지맘", text: "애기 돌반지 하나 있는데 지금 팔면 얼마 정도 받을 수 있을까요?", likes: 15, publishedAt: ago(3) },
  { author: "출장문의", text: "서귀포까지도 출장 오시나요? 방문이 어려워서요", likes: 12, publishedAt: ago(2) },
  { author: "첫방문", text: "보증서가 없는데 매입 가능한가요? 버릴까 고민 중입니다", likes: 20, publishedAt: ago(4) },
  { author: "시세체크", text: "오늘 시세 기준으로 파는 게 맞을까요? 더 오를 것 같기도 하고", likes: 27, publishedAt: ago(1) },
  { author: "금이빨2", text: "어머님 틀니에 붙은 금도 되나요?", likes: 9, publishedAt: ago(5) },
  { author: "비교중", text: "다른 데보다 여기가 더 쳐준다는 게 진짜인가요?", likes: 11, publishedAt: ago(3) },
  { author: "한쪽귀걸이", text: "짝 잃은 귀걸이 한쪽만 있는데 이것도 돈이 되나요?", likes: 14, publishedAt: ago(2) }
];

const STOP = new Set(["정말", "너무", "진짜", "이거", "그거", "저거", "이것", "그것", "저것", "여기", "거기", "저기", "우리", "이런", "그런", "저런", "어떻게", "얼마나", "있나요", "되나요", "하나", "그냥", "혹시", "영상", "구독"]);

export interface CommentInsight {
  topic: string;
  title: string; // 당근용 재작성 제목 (원문 복사 아님)
  count: number;
  likes: number;
  sample: string;
}

function commentTopic(text: string): string {
  if (/얼마|가격|시세|돈|만원/.test(text)) return "가격 문의";
  if (/14K|18K|24K|순금|함량|금니|금이빨|틀니/.test(text)) return "함량·종류 문의";
  if (/팔|매도|시기|지금|오를/.test(text)) return "매도 타이밍";
  if (/믿|사기|속|정직|비교|더 쳐/.test(text)) return "신뢰 확인";
  if (/끊어|이물질|보증서|한쪽|짝|버리|지저분/.test(text)) return "상태 문의";
  if (/출장|방문|어디|위치|서귀포|오시/.test(text)) return "방문·출장 문의";
  return "기타 문의";
}

export function analyzeComments(comments: YTComment[]): { insights: CommentInsight[]; keywords: { w: string; n: number }[] } {
  const isQ = (t: string) => /[?？]|까요|까|나요|인가|어떻게|얼마|왜|언제|되나|할까|괜찮|가능|되죠|될까/.test(t);
  const groups = new Map<string, { count: number; likes: number; best: YTComment }>();
  const kwCount = new Map<string, number>();
  for (const c of comments) {
    c.text.replace(/[^\uac00-\ud7a3a-zA-Z0-9 ]/g, " ").split(/\s+/)
      .filter((w) => w.length >= 2 && !STOP.has(w))
      .forEach((w) => kwCount.set(w, (kwCount.get(w) ?? 0) + 1));
    if (!isQ(c.text)) continue;
    const topic = commentTopic(c.text);
    const g = groups.get(topic) ?? { count: 0, likes: 0, best: c };
    g.count++; g.likes += c.likes;
    if (c.likes > g.best.likes) g.best = c;
    groups.set(topic, g);
  }
  const insights: CommentInsight[] = Array.from(groups.entries())
    .map(([topic, g]) => {
      const q = g.best.text.length > 42 ? g.best.text.slice(0, 42) + "…" : g.best.text;
      return { topic, title: `“${q}” 자주 묻는 질문 정리`, count: g.count, likes: g.likes, sample: g.best.text };
    })
    .sort((a, b) => (b.count * 2 + b.likes) - (a.count * 2 + a.likes))
    .slice(0, 6);
  const keywords = Array.from(kwCount.entries()).map(([w, n]) => ({ w, n })).sort((a, b) => b.n - a.n).slice(0, 8);
  return { insights, keywords };
}
