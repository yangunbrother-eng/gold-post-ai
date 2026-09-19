import { NextResponse } from "next/server";

// POST /api/generate-post
// body: { topic, brand, tone, type?, provider?: "auto"|"gpt"|"gemini", userKey? }
// "auto"면 키 없이도 되도록 cascade: 개인키 → 서버키(OpenAI/Gemini) → 무료 모델
// 항상 { provider, post } 또는 { error } 반환. 실패해도 클라이언트는 내장 템플릿으로 전환.

const SCHEMA_HINT = `{
  "title": "제목 (30자 이내)",
  "hook": "첫 문장 1~2줄",
  "body": "본문 전체",
  "coreMessage": "핵심 메시지 한 줄",
  "cta": "문의 유도 문구",
  "imageCopy": "이미지용 짧은 문구 (14자 이내)",
  "imageSubCopy": "이미지용 서브 문구",
  "hashtags": ["#태그1", "#태그2", "#태그3"],
  "type": "글 유형 그대로"
}`;

function buildPrompt(topic: string, brand: Record<string, unknown>, tone: string, type: string): string {
  return `당신은 당근 비즈프로필(동네 가게 소식) 전문 카피라이터입니다.
아래 정보를 바탕으로 가게 소식 글을 작성하고, 반드시 아래 JSON 스키마로만 응답하세요. 코드펜스 없이 순수 JSON만 출력하세요.

[주제] ${topic}
[글 유형] ${type}
[말투] ${tone}
[업체명] ${brand.businessName}
[주소] ${brand.address}
[전화] ${brand.phone}
[영업시간] ${brand.hours}
[소개] ${brand.intro}
[기본 CTA] ${brand.defaultCta}

규칙:
- 한국어, 과장·허위 금지, 이모지 2개 이내
- 본문 끝에 방문 정보(주소·영업시간·전화)와 CTA 포함
- 해시태그는 지역명 포함 3~5개
- type 필드는 "${type}" 그대로 유지

JSON 스키마:
${SCHEMA_HINT}`;
}

function parsePost(text: string, fallbackType: string) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("bad json");
  const j = JSON.parse(cleaned.slice(start, end + 1));
  if (!j.title || !j.body) throw new Error("bad fields");
  return {
    title: String(j.title).slice(0, 60),
    hook: String(j.hook ?? ""),
    body: String(j.body),
    coreMessage: String(j.coreMessage ?? ""),
    cta: String(j.cta ?? ""),
    imageCopy: String(j.imageCopy ?? "").slice(0, 20),
    imageSubCopy: String(j.imageSubCopy ?? ""),
    hashtags: Array.isArray(j.hashtags) ? j.hashtags.map(String).slice(0, 6) : [],
    type: String(j.type || fallbackType),
  };
}

async function callOpenAI(prompt: string, key: string): Promise<string> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 55000);
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: ctl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.8,
        max_tokens: 2000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "당근 비즈프로필 전문 카피라이터. 반드시 순수 JSON으로만 응답한다." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!r.ok) throw new Error(`openai ${r.status}`);
    const j = await r.json();
    const text = j.choices?.[0]?.message?.content ?? "";
    if (!text) throw new Error("empty");
    return text;
  } finally {
    clearTimeout(t);
  }
}

async function callGemini(prompt: string, key: string): Promise<string> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 55000);
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        signal: ctl.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.8, maxOutputTokens: 2048 },
        }),
      }
    );
    if (!r.ok) throw new Error(`gemini ${r.status}`);
    const j = await r.json();
    const text = j.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
    if (!text) throw new Error("empty");
    return text;
  } finally {
    clearTimeout(t);
  }
}

// 무료 경로 (키 불필요) — OpenAI 호환 엔드포인트
async function callFree(prompt: string): Promise<string> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 90000);
  try {
    const r = await fetch("https://text.pollinations.ai/openai", {
      method: "POST",
      signal: ctl.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai",
        temperature: 0.8,
        messages: [
          { role: "system", content: "당근 비즈프로필 전문 카피라이터. 반드시 순수 JSON으로만 응답한다." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!r.ok) throw new Error(`free ${r.status}`);
    const j = await r.json();
    const text = j.choices?.[0]?.message?.content ?? "";
    if (!text) throw new Error("empty");
    return text;
  } finally {
    clearTimeout(t);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const topic = String(body.topic ?? "").slice(0, 1000);
    const provider = body.provider === "gemini" ? "gemini" : body.provider === "gpt" ? "gpt" : "auto";
    const type = String(body.type ?? "자유 주제");
    const tone = String(body.tone ?? "친근한 상담형");
    const brand = (body.brand ?? {}) as Record<string, unknown>;
    if (!topic.trim()) return NextResponse.json({ error: "topic required" }, { status: 400 });

    const prompt = buildPrompt(topic, brand, tone, type);
    const userKey = String(body.userKey ?? "").trim();

    // 1) 개인 키 지정 시
    if (provider === "gpt" && userKey) {
      try {
        return NextResponse.json({ provider: "gpt", post: parsePost(await callOpenAI(prompt, userKey), type) });
      } catch (e) {
        return NextResponse.json({ error: "gpt_failed", detail: String(e).slice(0, 200) }, { status: 502 });
      }
    }
    if (provider === "gemini" && userKey) {
      try {
        return NextResponse.json({ provider: "gemini", post: parsePost(await callGemini(prompt, userKey), type) });
      } catch (e) {
        return NextResponse.json({ error: "gemini_failed", detail: String(e).slice(0, 200) }, { status: 502 });
      }
    }
    if (provider !== "auto") return NextResponse.json({ error: "no_key" }, { status: 400 });

    // 2) auto cascade — 키 없이도 끝까지 감
    const openaiEnv = process.env.OPENAI_API_KEY || "";
    if (openaiEnv) {
      try {
        return NextResponse.json({ provider: "gpt", post: parsePost(await callOpenAI(prompt, openaiEnv), type) });
      } catch (e) {
        console.error("[generate-post] env gpt failed:", e);
      }
    }
    const geminiEnv = process.env.GEMINI_API_KEY || "";
    if (geminiEnv) {
      try {
        return NextResponse.json({ provider: "gemini", post: parsePost(await callGemini(prompt, geminiEnv), type) });
      } catch (e) {
        console.error("[generate-post] env gemini failed:", e);
      }
    }
    try {
      return NextResponse.json({ provider: "auto", post: parsePost(await callFree(prompt), type) });
    } catch (e) {
      console.error("[generate-post] free failed:", e);
      return NextResponse.json({ error: "all_failed" }, { status: 502 });
    }
  } catch (e) {
    console.error("[generate-post]", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
