export const IMAGE_TYPES = [
  { id: "photo", name: "소식 실사형", prompt: "자연스러운 고급 제품 사진. 실제 촬영한 매장이라고 단정할 수 없는 예시 장면" },
  { id: "webtoon", name: "현대 웹툰형", prompt: "깔끔한 현대 한국 웹툰 일러스트. 절제된 선과 자연스러운 인물 비율" },
  { id: "thumbnail", name: "썸네일형", prompt: "한눈에 핵심이 보이는 썸네일 구도. 큰 피사체, 정돈된 배경, 여백" },
  { id: "card", name: "정보 카드형", prompt: "단순한 인포그래픽 일러스트. 아이콘과 시각적 비교를 활용하고 불필요한 장식 최소화" },
] as const;
export const IMAGE_MOODS = ["밝고 신뢰감 있게", "고급스럽고 차분하게", "따뜻하고 친근하게", "깔끔한 전문가 느낌"] as const;
export const SLOT_NAMES = ["대표 이미지", "첫 번째 보조 이미지", "두 번째 보조 이미지", "세 번째 보조 이미지"] as const;
export type ImageMethod = "chatgpt" | "server";
export interface ImageSettings {
  type: string; mood: string; requirements: string; referencePrompt: string;
  count: number; method: ImageMethod;
}
export interface StudioSlot { url: string; prompt: string; source: string; signature: string; }
export interface ImageStudioDraft {
  settings: ImageSettings;
  slots: StudioSlot[];
  reference: { name: string; dataUrl: string } | null;
}
export interface SavedImage { id: string; label: string; copy: string; bg: string; sub?: string; slot?: number; prompt?: string; source?: string; signature?: string; }
export const isImageUrl = (s: string) => /^(https?:\/\/|data:image\/(?:png|jpeg|webp);base64,)/i.test(s);
export const emptySlot = (): StudioSlot => ({ url: "", prompt: "", source: "", signature: "" });
export function newImageDraft(settings?: Partial<ImageSettings>, images: SavedImage[] = []): ImageStudioDraft {
  const base: ImageSettings = { type: "photo", mood: IMAGE_MOODS[0], requirements: "", referencePrompt: "첨부 이미지의 색감과 분위기를 참고하되, 현재 글에 맞게 새로 구성해 주세요.", count: 1, method: "chatgpt" };
  const next = { ...base, ...settings };
  if (!IMAGE_TYPES.some(t => t.id === next.type)) next.type = base.type;
  if (next.method !== "server") next.method = "chatgpt";
  next.count = Math.min(2, Math.max(1, Number(next.count) || 1));
  const slots = Array.from({ length: 4 }, emptySlot);
  images.forEach((image, i) => {
    const index = Number.isInteger(image.slot) ? image.slot! : i;
    if (index < 0 || index >= 4 || !isImageUrl(image.copy)) return;
    slots[index] = { url: image.copy, prompt: image.prompt || "", source: image.source || "saved", signature: image.signature || "" };
    next.count = Math.max(next.count, index + 1);
  });
  next.count = Math.min(2, next.count);
  return { settings: next, slots, reference: null };
}
export function draftSignature(title: string, body: string, draft: ImageStudioDraft): string {
  // A small change token only; not an authenticity or security hash.
  const text = JSON.stringify([title, body, draft.settings.type, draft.settings.mood, draft.settings.requirements, draft.settings.referencePrompt, draft.reference?.dataUrl]);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16);
}
export function imagePrompt(title: string, body: string, draft: ImageStudioDraft, index: number): string {
  const style = IMAGE_TYPES.find(t => t.id === draft.settings.type) || IMAGE_TYPES[0];
  const paragraphs = body.split(/\n\s*\n|\n(?=#{1,3}\s)/).map(p => p.trim()).filter(p => p && !p.startsWith("#태그"));
  const detail = index === 0 ? title : paragraphs[Math.min(index - 1, paragraphs.length - 1)] || body;
  return [
    "아래 우리 매장 소식에 사용할 이미지를 한 장 만들어 주세요. 본문은 시각적 소재를 고르는 참고 자료입니다.",
    `[위치] ${SLOT_NAMES[index] || SLOT_NAMES[0]}`,
    `[이미지 유형] ${style.name}: ${style.prompt}`,
    `[분위기] ${draft.settings.mood}`,
    `[제목] ${title.slice(0, 250)}`,
    `[이번 이미지의 핵심 장면] ${detail.slice(0, 1100)}`,
    `[현재 본문] ${body.slice(0, 4500)}`,
    `[추가 요청] ${draft.settings.requirements.trim() || "주제에 맞게 깔끔하게 구성해 주세요."}`,
    draft.reference ? `[첨부 참고 이미지 반영] ${draft.settings.referencePrompt.trim() || "첨부 이미지의 분위기를 참고해 주세요."}` : "",
    index ? "대표 이미지와 구도·거리·세부 소재를 다르게 하되 시리즈의 색감은 유지하세요." : "첫 이미지에서 소식의 핵심이 바로 이해되도록 구성하세요.",
    "가로형 3:2 구도. 핵심 피사체는 중앙에 배치. 워터마크·가짜 로고·확인되지 않은 시세나 가격을 넣지 마세요. 글자를 별도로 요청하지 않았다면 문자 없이 표현하세요. 허구의 고객 후기를 사실처럼 묘사하지 마세요.",
  ].filter(Boolean).join("\n\n");
}
export function chatImagePrompt(title: string, body: string, draft: ImageStudioDraft, indices: number[]): string {
  return `당근 소식용 이미지 ${indices.length}장을 각각 별도의 이미지로 생성해 주세요. 콜라주로 합치지 마세요.\n${draft.reference ? "첨부 참고 이미지를 먼저 확인하고 아래 반영 지시를 따라주세요. 이미지가 첨부되지 않았다면 먼저 첨부를 요청하세요.\n" : ""}\n` + indices.map((i, n) => `=== ${n + 1}. ${SLOT_NAMES[i]} ===\n${imagePrompt(title, body, draft, i)}`).join("\n\n");
}
/** Read and re-encode actual image bytes. No SVG, arbitrary URLs or enormous files. */
export async function prepareImage(file: Blob): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("JPG·PNG·WEBP 이미지 파일을 선택해 주세요.");
  if (!file.size || file.size > 10 * 1024 * 1024) throw new Error("10MB 이하의 이미지를 선택해 주세요.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { image.src = ""; reject(new Error("이미지를 읽지 못했어요. 다른 파일을 선택해 주세요.")); }, 12000);
      image.onload = () => { clearTimeout(timer); resolve(); };
      image.onerror = () => { clearTimeout(timer); reject(new Error("올바른 이미지 파일이 아니에요.")); };
      image.src = url;
    });
    if (!image.naturalWidth || image.naturalWidth * image.naturalHeight > 40000000) throw new Error("이미지가 너무 커요. 크기를 줄인 뒤 다시 선택해 주세요.");
    const scale = Math.min(1, 1536 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("이 브라우저에서 이미지를 처리하지 못했어요.");
    context.fillStyle = "#ffffff"; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.86, 0.74, 0.6, 0.45]) {
      const output = canvas.toDataURL("image/jpeg", quality);
      if (output.length <= 650000) return output;
    }
    throw new Error("브라우저에 저장하기엔 이미지가 커요. 더 작은 파일을 선택해 주세요.");
  } finally { URL.revokeObjectURL(url); }
}
