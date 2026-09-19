import { NextResponse } from "next/server";

// POST /api/generate-image
// body: { prompt: string, count?: 1|2, size?: "1024x1024"|"1536x1024", userKey? }
// - 개인 키(userKey) 또는 OPENAI_API_KEY가 있으면 gpt-image-1로 실생성
// - 없으면 무료 Pollinations(flux) URL 반환 → 키 없이 바로 체험 가능
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const prompt = String(body.prompt ?? "").slice(0, 2000);
    const count = body.count === 2 ? 2 : 1;
    if (!prompt.trim()) {
      return NextResponse.json({ error: "prompt required" }, { status: 400 });
    }

    const apiKey = String(body.userKey ?? "").trim() || process.env.OPENAI_API_KEY;

    // 1) OpenAI 키가 있으면 실제 AI 생성
    if (apiKey) {
      try {
        const size = body.size === "1024x1024" ? "1024x1024" : "1536x1024";
        const results: { url: string; dataUrl?: string; revisedPrompt?: string }[] = [];
        for (let i = 0; i < count; i++) {
          const r = await fetch("https://api.openai.com/v1/images/generations", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: "gpt-image-1",
              prompt: i === 1 ? `${prompt} (alternate angle, different composition)` : prompt,
              size,
            }),
          });
          if (!r.ok) throw new Error(`openai ${r.status}`);
          const j = await r.json();
          const d = j.data?.[0];
          if (d?.b64_json) {
            results.push({
              url: `data:image/png;base64,${d.b64_json}`,
              dataUrl: `data:image/png;base64,${d.b64_json}`,
              revisedPrompt: d.revised_prompt,
            });
          } else if (d?.url) {
            results.push({ url: d.url, revisedPrompt: d.revised_prompt });
          }
        }
        if (results.length) {
          return NextResponse.json({ provider: "openai", images: results });
        }
      } catch (e) {
        console.error("[generate-image] openai failed, fallback:", e);
        // 아래 무료 폴백으로 계속
      }
    }

    // 2) 무료 폴백 (키 불필요) — Pollinations flux
    const images = Array.from({ length: count }, (_, i) => {
      const seed = Math.floor(Math.random() * 999999);
      const p = i === 1 ? `${prompt} (alternate angle, different composition)` : prompt;
      const url =
        `https://image.pollinations.ai/prompt/${encodeURIComponent(p)}` +
        `?width=1024&height=768&seed=${seed}&nologo=true&model=flux`;
      return { url, seed };
    });
    return NextResponse.json({ provider: "pollinations", images, needKey: !apiKey });
  } catch (e) {
    console.error("[generate-image]", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
