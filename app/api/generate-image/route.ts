import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
const LIMIT = 1500000;
const MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
const headers = { "Cache-Control": "no-store" };
const fail = (error: string, message: string, status: number) => NextResponse.json({ error, message }, { status, headers });

export async function GET() {
  return NextResponse.json({ configured: !!process.env.OPENAI_API_KEY?.trim(), referenceSupported: true }, { headers });
}

function referenceFile(value: unknown): Blob | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 900000) throw new Error("reference");
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) throw new Error("reference");
  const bytes = Buffer.from(match[2], "base64");
  const type = match[1];
  const valid = type === "jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : type === "png" ? bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a"
    : bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP";
  if (!valid) throw new Error("reference");
  return new Blob([new Uint8Array(bytes)], { type: `image/${type}` });
}

/** Read a bounded JSON body before accepting potentially large base64 uploads. */
async function readBody(req: Request): Promise<Record<string, unknown>> {
  if (Number(req.headers.get("content-length") || 0) > LIMIT) throw new Error("size");
  const reader = req.body?.getReader();
  if (!reader) throw new Error("json");
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > LIMIT) { await reader.cancel(); throw new Error("size"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const result: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error("json");
  return result as Record<string, unknown>;
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) return fail("origin", "이 사이트에서 다시 시도해 주세요.", 403);
  let body: Record<string, unknown>;
  let image: Blob | null;
  try { body = await readBody(req); image = referenceFile(body.referenceImage); }
  catch (error) {
    return error instanceof Error && error.message === "size"
      ? fail("size", "이미지가 너무 커요. 작은 파일을 다시 선택해 주세요.", 413)
      : fail("input", "입력 내용이나 참고 이미지 파일을 확인해 주세요.", 400);
  }
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt || prompt.length > 12000) return fail("prompt", "이미지 요청사항을 12,000자 이내로 입력해 주세요.", 400);
  // Preserve the existing optional per-request key without storing or logging it.
  const key = (typeof body.userKey === "string" ? body.userKey.trim() : "") || process.env.OPENAI_API_KEY?.trim();
  if (!key) return fail("not_configured", "사이트 이미지 API가 연결되지 않았어요. ChatGPT 생성 또는 파일 선택을 사용해 주세요.", 503);
  const count = body.count === 2 ? 2 : 1;
  const size = body.size === "1024x1024" ? "1024x1024" : "1536x1024";
  const settings = { model: MODEL, prompt, n: count, size, quality: "medium", output_format: "jpeg", output_compression: 80 };
  const requestHeaders: Record<string, string> = { Authorization: `Bearer ${key}` };
  let payload: string | FormData;
  if (image) {
    const form = new FormData();
    for (const [name, value] of Object.entries(settings)) form.append(name, String(value));
    // This is a real reference file sent to Images Edits, not just its filename in a prompt.
    form.append("image[]", image, `reference.${image.type.split("/")[1]}`);
    payload = form;
  } else { requestHeaders["Content-Type"] = "application/json"; payload = JSON.stringify(settings); }
  const abort = new AbortController();
  const cancel = () => abort.abort(); req.signal.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(cancel, 100000);
  try {
    const response = await fetch(`https://api.openai.com/v1/images/${image ? "edits" : "generations"}`, { method: "POST", headers: requestHeaders, body: payload, signal: abort.signal, cache: "no-store" });
    if (!response.ok) {
      if (response.status === 429) return fail("quota", "이미지 API 한도 또는 잔액을 확인해 주세요. 잠시 후 다시 시도할 수 있어요.", 429);
      if ([401, 403].includes(response.status)) return fail("key", "이미지 API 키나 모델 사용 권한을 확인해 주세요.", 502);
      return fail("provider", "이미지 제공자가 요청을 처리하지 못했어요. 요청사항을 확인한 뒤 다시 시도해 주세요.", 502);
    }
    const result = await response.json();
    const images = (Array.isArray(result.data) ? result.data : []).flatMap((item: { b64_json?: string }) =>
      typeof item.b64_json === "string" && item.b64_json.length > 20 ? [{ url: `data:image/jpeg;base64,${item.b64_json}` }] : []);
    if (!images.length) return fail("empty", "이미지 결과를 받지 못했어요. 다시 시도해 주세요.", 502);
    return NextResponse.json({ provider: "openai", images, referenceUsed: !!image }, { headers });
  } catch {
    return fail("unavailable", abort.signal.aborted ? "이미지 생성이 취소되거나 응답 시간이 초과됐어요." : "이미지 서버에 연결하지 못했어요.", 502);
  } finally { clearTimeout(timer); req.signal.removeEventListener("abort", cancel); }
}
