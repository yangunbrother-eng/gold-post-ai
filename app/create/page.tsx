"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import PhonePreview from "@/components/PhonePreview";
import { useBrand, useContents, uid, todayStr } from "@/lib/store";
import { checkSimilarity, detectType, generatePost, rewritePost, suggestTitles } from "@/lib/ai";
import { AI_IMAGE_STYLES, buildGptPastePrompt, buildImagePrompt } from "@/lib/ai-image";
import { HostAi, buildHostPrompt, openHostAi, splitPasted } from "@/lib/ai-host";
import { EDIT_ACTIONS, QUICK_TOPICS } from "@/lib/sample-data";
import { ContentType, GeneratedPost } from "@/lib/types";

function CreateInner() {
  const params = useSearchParams();
  const { brand, tone } = useBrand();
  const { items, upsert } = useContents();

  const [input, setInput] = useState(params.get("topic") ?? "오늘 금값이 많이 올랐는데 지금 팔아도 되는지 궁금해하는 고객용 글");
  const [quick, setQuick] = useState<string>("오늘의 시세");
  const [post, setPost] = useState<GeneratedPost | null>(null);
  const [generating, setGenerating] = useState(false);
  // PC·모바일 동일: Gemini 탭 방식이 기본 (Gemini 모바일)
  const isMobile = typeof navigator !== "undefined" && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  const [provider, setProvider] = useState<HostAi>("gemini");
  const [hostPrompt, setHostPrompt] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [pasted, setPasted] = useState("");
  const [typedBody, setTypedBody] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  // AI 실사 이미지 (글 내용 기반, 1~2장)
  const [imgCount, setImgCount] = useState<1 | 2>(1);
  const [imgStyleId, setImgStyleId] = useState(AI_IMAGE_STYLES[0].id);
  const [aiImages, setAiImages] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiProvider, setAiProvider] = useState("");
  const [altTitles, setAltTitles] = useState<string[]>([]);
  const [toast, setToast] = useState("");
  const [showSend, setShowSend] = useState(false);
  const [sendStep, setSendStep] = useState(0);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [imgUrls, setImgUrls] = useState<(string | null)[]>([null, null]);
  const [imgReady, setImgReady] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const similarity = useMemo(() => {
    if (!body) return 0;
    return checkSimilarity(body, items.slice(0, 8));
  }, [body, items]);

  const detected: ContentType = useMemo(() => detectType(input + " " + quick), [input, quick]);

  const say = (m: string) => { setToast(m); setTimeout(() => setToast(""), 1800); };

  const typeOf = (q: string): ContentType | undefined => {
    const typeMap: Record<string, ContentType> = {
      "오늘의 시세": "시세", "고객 후기": "고객 후기", "실제 사례": "실제 사례", "상품 소개": "상품 소개",
      "FAQ": "FAQ", "이벤트": "이벤트", "영업 안내": "영업 안내", "방문 안내": "방문 안내",
      "정보성 콘텐츠": "정보성", "후기형 콘텐츠": "후기형", "문의 유도형": "문의 유도형", "자유 주제": "자유 주제"
    };
    return typeMap[q];
  };

  const typeOut = (result: GeneratedPost) => {
    // 타이핑 효과
    let i = 0;
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      i += 14;
      setTypedBody(result.body.slice(0, i));
      if (i >= result.body.length) {
        if (timer.current) clearInterval(timer.current);
        setGenerating(false);
        setPost(result);
        setTitle(result.title); setBody(result.body);
      }
    }, 18);
  };

  const runGenerate = async (seedExtra = 0) => {
    if (!input.trim()) { say("먼저 내용을 입력하세요"); return; }
    const forcedType = typeOf(quick) ?? detectType(input + " " + quick);

    // 내장 생성: 사이트 안에서 즉시 작성
    if (provider === "template") {
      setGenerating(true);
      setPost(null); setTypedBody(""); setAltTitles([]);
      typeOut(generatePost(input, brand, tone, forcedType, seedExtra));
      return;
    }

    // 자동 AI: 키 없이 서버 무료 AI가 직접 작성 (딸깍 방식)
    if (provider === "auto") {
      setGenerating(true);
      setPost(null); setTypedBody(""); setAltTitles([]);
      try {
        const r = await fetch("/api/generate-post", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: input, brand, tone, type: forcedType, provider: "auto" }),
        });
        const j = await r.json();
        if (j.post) {
          typeOut({ ...j.post, type: forcedType });
          say("AI가 자동으로 작성했습니다");
          return;
        }
        say("AI 바쁨 — 내장 생성으로 전환");
      } catch {
        say("AI 바쁨 — 내장 생성으로 전환");
      }
      typeOut(generatePost(input, brand, tone, forcedType, seedExtra));
      return;
    }

    // 호스트 GPT 새 탭: PC는 확장(gpt-autorun.js)이 전송까지 대신 눌러줌, 모바일은 직접 전송
    const prompt = buildHostPrompt(input, brand, tone, forcedType);
    setHostPrompt(prompt);
    try { await navigator.clipboard.writeText(prompt); } catch { /* URL에 이미 포함됨 */ }
    openHostAi(provider, prompt);
    setShowPaste(true);
    const hostName = provider === "chatgpt" ? "ChatGPT" : "Gemini";
    say(isMobile
      ? `${hostName}가 열렸습니다 · 붙여넣기 후 전송을 눌러주세요`
      : "GPT 탭이 열렸습니다 · 확장이 전송까지 눌러줘요 · 결과만 복사해오세요");
  };

  const applyPasted = () => {
    const { title: t, body: b } = splitPasted(pasted);
    if (!t && !b) { say("붙여넣은 글을 확인하세요"); return; }
    const forcedType = typeOf(quick) ?? detectType(input + " " + quick);
    setTitle(t || "무제"); setBody(b);
    setTypedBody(b);
    setPost({ title: t || "무제", hook: b.split("\n")[0] ?? "", body: b, coreMessage: "", cta: brand.defaultCta, imageCopy: (t || "").slice(0, 14), imageSubCopy: brand.businessName, hashtags: [], type: forcedType });
    say("글 적용됨 · 아래에서 이미지 만드세요");
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) { say("클립보드가 비어있습니다"); return; }
      setPasted(text);
      const { title: t, body: b } = splitPasted(text);
      if (!t && !b) { say("글을 가져왔습니다. 내용을 확인 후 적용하세요"); return; }
      const forcedType = typeOf(quick) ?? detectType(input + " " + quick);
      setTitle(t || "무제"); setBody(b);
      setTypedBody(b);
      setPost({ title: t || "무제", hook: b.split("\n")[0] ?? "", body: b, coreMessage: "", cta: brand.defaultCta, imageCopy: (t || "").slice(0, 14), imageSubCopy: brand.businessName, hashtags: [], type: forcedType });
      say("✓ 클립보드에서 자동 적용되었습니다!");
    } catch {
      say("클립보드 접근 권한이 필요합니다. 아래 입력창에 직접 붙여넣으세요.");
    }
  };

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  useEffect(() => {
    const t = params.get("topic");
    if (t) { setInput(t); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyEdit = (id: string) => {
    if (!post && !body) { say("먼저 AI 소식 만들기를 눌러주세요"); return; }
    const base: GeneratedPost = post ?? { title, hook: "", body, coreMessage: "", cta: "", imageCopy: title.slice(0, 14), imageSubCopy: brand.businessName, hashtags: [], type: detected };
    if (id === "regen") { void runGenerate(Math.floor(Math.random() * 999)); return; }
    if (id === "titles") { setAltTitles(suggestTitles(base)); say("제목 5개를 생성했습니다"); return; }
    const next = rewritePost({ ...base, title, body }, id, brand);
    setPost(next); setTitle(next.title); setBody(next.body); setTypedBody(next.body);
    say("수정 완료");
  };

  const copy = async (t: string, msg: string) => {
    try { await navigator.clipboard.writeText(t); say(msg); }
    catch { say("복사 실패 — 직접 선택해 복사하세요"); }
  };

  const saveContent = (status: "AI 작성 완료" | "검수 완료" | "발행 예정" = "AI 작성 완료") => {
    const id = savedId ?? uid();
    upsert({
      id, title: title || "무제", body, hook: post?.hook ?? "",
      coreMessage: post?.coreMessage ?? "", cta: post?.cta ?? brand.defaultCta,
      imageCopy: post?.imageCopy ?? title.slice(0, 14), imageSubCopy: brand.businessName, hashtags: post?.hashtags ?? [],
      type: (post?.type ?? detected), status, date: todayStr(), createdAt: todayStr(),
      images: aiImages.map((url, i) => ({ id: uid(), label: i === 0 ? "대표" : "추가", copy: url, bg: imgStyleId, sub: "" })),
      branchId: "b1"
    });
    setSavedId(id);
    say(status === "발행 예정" ? "발행 예약됨 · 캘린더에 등록" : "보관함에 저장됨");
  };

  // 글 내용 → AI 실사 이미지 1~2장 생성 (GPT 이미지 API, 키 없으면 무료 생성)
  const runImageGenerate = async (regenSlot?: number) => {
    if (!title && !body) { say("먼저 글을 생성하세요"); return; }
    setAiLoading(true);
    try {
      const style = AI_IMAGE_STYLES.find((s) => s.id === imgStyleId) ?? AI_IMAGE_STYLES[0];
      // 낱장 재생성 vs 전체 생성
      const slots: (1 | 2)[] = regenSlot ? [regenSlot as 1 | 2] : (imgCount === 2 ? [1, 2] : [1]);
      const next = [...aiImages];
      for (const slot of slots) {
        const prompt = buildImagePrompt(title || input, body || input, imgStyleId, slot);
        const r = await fetch("/api/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, count: 1 }),
        });
        const j = await r.json();
        const url = j.images?.[0]?.url;
        if (!url) throw new Error("no image");
        next[slot - 1] = url;
        setAiImages([...next]);
        setAiProvider(j.provider === "openai" ? "GPT 이미지" : "AI 생성");
      }
      void style;
      say(aiImages.length ? "이미지 다시 생성됨" : "AI 이미지 생성됨");
    } catch {
      say("이미지 생성 실패 — 다시 눌러주세요");
    } finally {
      setAiLoading(false);
    }
  };

  const urlToDataUrl = async (url: string): Promise<string | null> => {
    try {
      if (url.startsWith("data:")) return url;
      const res = await fetch(url);
      const blob = await res.blob();
      return await new Promise((res2) => {
        const fr = new FileReader();
        fr.onload = () => res2(String(fr.result));
        fr.onerror = () => res2(null);
        fr.readAsDataURL(blob);
      });
    } catch { return null; }
  };

  const copyGptPrompt = async () => {
    const style = AI_IMAGE_STYLES.find((s) => s.id === imgStyleId)?.name ?? "";
    await copy(buildGptPastePrompt(title || input, body || input, imgCount, style), "GPT용 프롬프트 복사됨");
  };

  const payloadObj = {
    source: "carrot-post-ai", version: "ext/1.2",
    action: "autofill-news",
    title, body,
    images: aiImages.map((url, i) => ({ slot: i + 1, url, dataUrl: imgUrls[i] ?? url })),
    business: brand.businessName
  };
  const payload = JSON.stringify(payloadObj, null, 2);
  const displayPayload = payload.length > 4000
    ? payload.replace(/"dataUrl": "[^"]*"/g, '"dataUrl": "(이미지 포함됨 ✓)"')
    : payload;

  // 보내기 열기 + AI 이미지 포함 (확장프로그램에서 자동 첨부됨)
  const openSend = async () => {
    setShowSend(true); setSendStep(0);
    setImgReady(false);
    try {
      const converted = await Promise.all(aiImages.map((u) => urlToDataUrl(u)));
      setImgUrls(converted);
      setImgReady(true);
    } catch { setImgReady(true); }
  };

  return (
    <div className="min-h-screen flex">
      <Sidebar bizName={brand.businessName} extConnected={sendStep >= 2} />
      <div className="flex-1 min-w-0">
        <Topbar title="당근 소식 만들기" sub="입력 → 생성 → 이미지 → 미리보기 → 보내기" />
        <main className="max-w-[1240px] mx-auto px-4 lg:px-8 py-6 space-y-5">
          {/* 히어로 입력 */}
          <section className="card p-5 lg:p-8 animate-fadeUp">
            <div className="hidden lg:block">
              <h1 className="text-[28px] font-black tracking-tight">오늘 당근에 어떤 소식을 올릴까요?</h1>
              <p className="text-[14px] text-neutral-500 mt-1">주제만 입력하세요. 제목·본문·Hook·CTA·이미지 문구까지 AI가 한 번에 만듭니다. <span className="font-bold text-neutral-700">3~5분 완성</span></p>
            </div>
            <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={3}
              className="input-big mt-4" placeholder="오늘 올리고 싶은 내용을 입력하세요. 예) 오늘 금값이 많이 올랐는데 지금 팔아도 되는지 궁금해하는 고객용 글" />
            <div className="mt-3">
              <div className="label mb-2">빠른 주제 선택 · 업종에 맞게 수정 가능</div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_TOPICS.map((q) => (
                  <button key={q} onClick={() => { setQuick(q); if (q !== "자유 주제" && !input) setInput(q); }} className={`chip ${quick === q ? "active" : ""}`}>{q}</button>
                ))}
              </div>
            </div>
            <div className="mt-3">
              <div className="label mb-2">작성 방식 · Gemini 탭으로 작성하고 결과만 가져오세요</div>
              <div className="flex flex-wrap items-center gap-1.5">
                {([["gemini", "📱 Gemini 모바일 (추천) ↗"], ["chatgpt", "ChatGPT 새탭 ↗"], ["auto", "✦ 자동 AI"], ["template", "내장 생성"]] as [HostAi, string][]).map(([id, label]) => (
                  <button key={id} onClick={() => setProvider(id)} className={`chip !text-[12.5px] ${provider === id ? "active" : ""}`}>{label}</button>
                ))}
              </div>
            </div>
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2.5">
              <button onClick={() => void runGenerate(0)} disabled={generating}
                className="btn-primary w-full sm:w-auto px-6 py-3.5 text-[15px] font-extrabold disabled:opacity-60 text-center">
                {generating ? "✦ AI 작성 중…" : provider === "auto" ? "✦ AI 소식 만들기" : provider === "template" ? "✦ 내장으로 만들기"
                  : `✦ ${provider === "chatgpt" ? "ChatGPT" : "Gemini"} 열어 만들기 ↗`}
              </button>
              <span className="text-[12.5px] text-neutral-500">감지된 유형: <b className="text-neutral-800">{detected}</b> · 말투: <b className="text-neutral-800">{tone}</b></span>
              {similarity >= 55 && (
                <span className="text-[12.5px] font-bold bg-red-50 text-red-600 border border-red-200 rounded-full px-3 py-1.5 animate-pop">
                  ⚠ 최근 게시글과 {similarity}% 유사합니다
                  <button className="ml-2 underline" onClick={() => applyEdit("different")}>완전히 다르게 만들기</button>
                </span>
              )}
            </div>
          </section>

          {/* GPT 결과 붙여넣기 — 새 탭 GPT에서 작성한 글을 여기로 */}
          {showPaste && (provider === "chatgpt" || provider === "gemini") && (
            <section className="card p-4 sm:p-5 lg:p-6 animate-pop border-2" style={{ borderColor: "var(--brand)" }}>
              <div className="flex items-center justify-between flex-wrap gap-1">
                <h3 className="font-extrabold tracking-tight">GPT 결과 가져오기</h3>
                <span className="text-neutral-400 text-[12px] font-semibold">복사한 글을 바로 적용하세요</span>
              </div>
              <textarea value={pasted} onChange={(e) => setPasted(e.target.value)} rows={6}
                className="mt-3 w-full rounded-xl border border-neutral-200 px-4 py-3 text-[13.5px] leading-relaxed outline-none focus:border-neutral-400"
                placeholder={"제목: ...\n본문:\n...\n해시태그: ..."} />
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={pasteFromClipboard} className="btn-primary flex-1 sm:flex-none px-5 py-2.5 text-[13.5px] font-bold">📋 클립보드에서 바로 가져오기</button>
                <button onClick={applyPasted} className="btn-ghost flex-1 sm:flex-none px-4 py-2.5 text-[13px] font-bold">입력창 내용 적용</button>
                <button onClick={() => void runGenerate(0)} className="btn-ghost w-full sm:w-auto px-4 py-2.5 text-[13px] font-bold">GPT 다시 열기 ↗</button>
                {hostPrompt && (
                  <button onClick={() => void copy(hostPrompt, "지시문을 복사했습니다 · Gemini에 붙여넣으세요")} className="btn-ghost w-full sm:w-auto px-4 py-2.5 text-[13px] font-bold">📝 지시문 다시 복사</button>
                )}
              </div>
            </section>
          )}

          {/* 2단 */}
          <div className="grid lg:grid-cols-[1fr_380px] gap-5 items-start">
            {/* 왼쪽 편집 */}
            <div className="space-y-5">
              <section className="card p-5 lg:p-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold tracking-tight">AI 콘텐츠 편집</h3>
                  {post && <span className="text-[11.5px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">● 생성 완료 · {post.type}</span>}
                </div>
                {!post && !generating && !body && (
                  <div className="mt-4 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center text-[13.5px] text-neutral-500">
                    위 입력창에 주제를 쓰고 <b>AI 소식 만들기</b>를 눌러보세요.<br />제목·Hook·본문·CTA·해시태그가 자동 생성됩니다.
                  </div>
                )}
                {(generating || typedBody || body) && (
                  <div className="mt-4 space-y-4">
                    <div>
                      <div className="label mb-1.5">제목</div>
                      <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-[15px] font-bold outline-none focus:border-neutral-400" placeholder="제목" />
                      {altTitles.length > 0 && (
                        <div className="mt-2 rounded-xl bg-neutral-50 border border-neutral-200 p-3 space-y-1.5 animate-pop">
                          {altTitles.map((t) => (
                            <button key={t} onClick={() => { setTitle(t); say("제목 적용됨"); }} className="block w-full text-left text-[13px] font-semibold hover:bg-white rounded-lg px-2.5 py-1.5 border border-transparent hover:border-neutral-200">＋ {t}</button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="label mb-1.5">Hook · 첫 문장 {post && <span className="text-neutral-400">— {post.hook.slice(0, 60)}…</span>}</div>
                    </div>
                    <div>
                      <div className="label mb-1.5">본문 {generating && <span className="typing text-[12px]">생성 중</span>}</div>
                      <textarea value={generating ? typedBody : body} onChange={(e) => setBody(e.target.value)} rows={14}
                        className="w-full rounded-xl border border-neutral-200 px-4 py-3.5 text-[14px] leading-relaxed outline-none focus:border-neutral-400 whitespace-pre-wrap" />
                    </div>
                    {post && (
                      <div className="grid sm:grid-cols-3 gap-2 text-[12.5px]">
                        <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-3"><b>핵심 메시지</b><br />{post.coreMessage}</div>
                        <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-3"><b>문의 유도</b><br />{post.cta.slice(0, 60)}…</div>
                        <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-3"><b>해시태그</b><br />{post.hashtags.join(" ")}</div>
                      </div>
                    )}
                    <div>
                      <div className="label mb-2">AI 수정 · 다시 입력 없이 바로 반영</div>
                      <div className="flex flex-wrap gap-1.5">
                        {EDIT_ACTIONS.map((a) => (
                          <button key={a.id} onClick={() => applyEdit(a.id)} className="chip !text-[12.5px]">{a.label}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* 이미지 — 글 내용 기반 AI 실사 생성 (1~2장) */}
              <section id="images" className="card p-5 lg:p-6 scroll-mt-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-extrabold tracking-tight">소식 이미지 <span className="text-neutral-400 text-[12px] font-semibold">글 내용 기반 AI 생성 · 최대 2장</span></h3>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12px] font-bold text-neutral-500">장수:</span>
                    {([1, 2] as const).map((n) => (
                      <button key={n} onClick={() => setImgCount(n)}
                        className={`rounded-lg px-3 py-1.5 text-[12.5px] font-bold border ${imgCount === n ? "bg-neutral-900 text-white border-neutral-900" : "border-neutral-200 text-neutral-500"}`}>
                        {n}장
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-3">
                  <div className="label mb-2">스타일 선택</div>
                  <div className="flex flex-wrap gap-1.5">
                    {AI_IMAGE_STYLES.map((s) => (
                      <button key={s.id} title={s.desc} onClick={() => setImgStyleId(s.id)}
                        className={`chip !text-[12.5px] ${imgStyleId === s.id ? "active" : ""}`}>{s.name}</button>
                    ))}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => void runImageGenerate()} disabled={aiLoading || (!title && !body)}
                    className="btn-primary px-5 py-3 text-[14px] font-extrabold disabled:opacity-50">
                    {aiLoading ? "🎨 AI 이미지 만드는 중…" : `✦ 글 내용으로 이미지 ${imgCount}장 만들기`}
                  </button>
                  <button onClick={() => void copyGptPrompt()} className="btn-ghost px-4 py-3 text-[13px] font-bold">GPT용 프롬프트 복사</button>
                </div>
                {!title && !body && (
                  <p className="mt-2 text-[12.5px] text-neutral-400">먼저 위에서 <b>AI 소식 만들기</b>를 눌러 글을 생성하면, 그 내용을 GPT에 올려 이미지를 만듭니다.</p>
                )}
                {aiProvider && <p className="mt-2 text-[11.5px] font-bold text-neutral-400">제공: {aiProvider} · 얼굴·글자·워터마크 없음 · 당근 첨부용 4:3</p>}
                <div className="mt-4 grid sm:grid-cols-2 gap-3">
                  {aiLoading && aiImages.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-neutral-300 min-h-[220px] flex flex-col items-center justify-center text-neutral-400 text-[13px] font-semibold gap-2 animate-pulse">
                      <span className="text-2xl">🎨</span> 글 내용을 분석해 이미지 생성 중…
                    </div>
                  )}
                  {aiImages.map((url, i) => (
                    <div key={`${i}-${url.slice(-24)}`} className="rounded-2xl overflow-hidden border border-neutral-200 animate-pop">
                      <div className="aspect-[4/3] bg-neutral-100 relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`AI 이미지 ${i + 1}`} className="w-full h-full object-cover" />
                        <span className="absolute top-2 left-2 text-[11px] font-bold text-white bg-black/55 rounded-full px-2.5 py-1">이미지 {i + 1}{i === 0 ? " · 대표" : ""}</span>
                      </div>
                      <div className="p-3 flex gap-1.5 bg-white">
                        <button onClick={() => void runImageGenerate((i + 1) as 1 | 2)} disabled={aiLoading} className="flex-1 btn-ghost py-2 text-[12px] font-bold disabled:opacity-50">↻ 다시 만들기</button>
                        <a href={url} download={`carrot-ai-${i + 1}.jpg`} target="_blank" rel="noreferrer" className="flex-1 btn-ghost py-2 text-[12px] font-bold text-center">다운로드</a>
                        <button onClick={() => { setAiImages(aiImages.filter((_, j) => j !== i)); say("이미지 삭제됨"); }} className="btn-ghost py-2 px-3 text-[12px] font-bold text-red-500">삭제</button>
                      </div>
                    </div>
                  ))}
                  {!aiLoading && aiImages.length === 0 && (
                    <button onClick={() => void runImageGenerate()} disabled={!title && !body}
                      className="rounded-2xl border border-dashed border-neutral-300 text-neutral-400 text-[13px] font-semibold hover:bg-neutral-50 transition min-h-[220px] disabled:opacity-50">
                      ＋ 글 내용 기반 AI 이미지 생성<br /><span className="text-[11.5px] font-normal">위에서 장수·스타일 선택 후 생성 · 실사형</span>
                    </button>
                  )}
                  {!aiLoading && aiImages.length === 1 && imgCount === 2 && (
                    <button onClick={() => void runImageGenerate(2)}
                      className="rounded-2xl border border-dashed border-neutral-300 text-neutral-400 text-[13px] font-semibold hover:bg-neutral-50 transition min-h-[220px]">
                      ＋ 두 번째 이미지 만들기<br /><span className="text-[11.5px] font-normal">다른 구도로 자동 생성</span>
                    </button>
                  )}
                </div>
              </section>

              {/* 게시 준비 */}
              <section className="card p-5 lg:p-6">
                <h3 className="font-extrabold tracking-tight">당근 게시 준비</h3>
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button onClick={() => copy(title, "제목 복사됨")} className="btn-ghost py-2.5 text-[13px] font-bold">제목 복사</button>
                  <button onClick={() => copy(body, "본문 복사됨")} className="btn-ghost py-2.5 text-[13px] font-bold">본문 복사</button>
                  <button onClick={() => copy(`${title}\n\n${body}\n\n${(post?.hashtags ?? []).join(" ")}`, "전체 복사됨")} className="btn-ghost py-2.5 text-[13px] font-bold">전체 복사</button>
                  <button onClick={() => { aiImages[0] ? window.open(aiImages[0], "_blank") : say("먼저 AI 이미지를 생성하세요"); }} className="btn-ghost py-2.5 text-[13px] font-bold">이미지 열기·저장</button>
                  <button onClick={() => window.open("https://www.daangn.com/kr/business", "_blank")} className="btn-ghost py-2.5 text-[13px] font-bold">당근 페이지 열기 ↗</button>
                  <button onClick={() => saveContent("AI 작성 완료")} className="btn-ghost py-2.5 text-[13px] font-bold">보관함에 저장</button>
                </div>
                <button onClick={openSend} disabled={!title || !body}
                  className="btn-primary w-full mt-3 py-4 text-[15px] font-black disabled:opacity-50">당근에 보내기 ➔</button>
                <p className="mt-2 text-[12px] text-neutral-400 text-center">Extension 연동 구조 · 자동 입력 후 사람이 최종 등록 (안전 발행)</p>
              </section>
            </div>

            {/* 오른쪽 미리보기 */}
            <div className="lg:sticky lg:top-6 space-y-4">
              <div className="card p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-extrabold text-[14px]">당근 스타일 미리보기</h3>
                  <span className="text-[11px] font-bold text-neutral-400">실시간 반영</span>
                </div>
                <div className="flex justify-center">
                  <PhonePreview title={title} body={generating ? typedBody : body} bizName={brand.businessName} time="방금 전"
                    imageCopy="" imageSub="" bg="#111111" secondImage={null} logo={brand.logoUrl} logoText={brand.logoText} aiImages={aiImages} />
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => saveContent("검수 완료")} className="flex-1 btn-ghost py-2 text-[12.5px] font-bold">검수 완료</button>
                  <button onClick={() => saveContent("발행 예정")} className="flex-1 btn-ghost py-2 text-[12.5px] font-bold">내일 발행 예약</button>
                </div>
              </div>
              <div className="card p-4 text-[12px] text-neutral-500 leading-relaxed">
                <b className="text-neutral-800">자동 입력 구조</b><br />
                웹사이트 생성 → 당근에 보내기 → Extension 전달 → 소식 작성 페이지 → 제목·본문·이미지 자동 입력 → 최종 확인 후 등록
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* 보내기 모달 */}
      {showSend && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowSend(false)}>
          <div className="bg-white rounded-2xl max-w-[560px] w-full p-6 animate-pop max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[18px] font-black tracking-tight">당근에 보내기</h3>
            <p className="text-[13px] text-neutral-500 mt-1"><b>복사 → 당근 페이지 → ✦ AI 글 채우기</b> 세 단계면 끝납니다. (확장이 클립보드를 바로 읽어요)</p>
            <div className="mt-4 space-y-2">
              {["아래 Payload 복사 (이미지 포함)", "당근 비즈니스 소식 작성 페이지 열기", "페이지의 ✦ AI 글 채우기 클릭 → 제목·본문·이미지 자동 입력", "최종 확인 후 등록 클릭"].map((s, i) => (
                <button key={s} onClick={() => setSendStep(i)} className={`w-full text-left rounded-xl border px-4 py-3 text-[13px] font-semibold transition ${sendStep >= i ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200"}`}>
                  {i + 1}. {s} {sendStep === i ? "←" : sendStep > i ? "✓" : ""}
                </button>
              ))}
            </div>
            <pre className="mt-4 rounded-xl bg-neutral-950 text-emerald-200 text-[11px] p-4 overflow-x-auto leading-relaxed max-h-[220px] overflow-y-auto">{displayPayload}</pre>
            <p className="mt-1.5 text-[12px] font-bold text-neutral-500">{imgReady ? "✓ 이미지 포함됨 — 당근에서 자동 첨부됩니다" : "이미지 준비 중…"}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={() => { void copy(payload, "복사됨! 당근 페이지를 열어 ✦ AI 글 채우기를 누르세요"); setSendStep(1); }} className="btn-ghost py-3 text-[13px] font-bold">Payload 복사</button>
              <button onClick={() => { window.open("https://www.daangn.com/kr/business", "_blank"); setSendStep(2); saveContent("발행 예정"); }} className="btn-primary py-3 text-[13px] font-bold">당근 페이지 열기 ↗</button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-neutral-900 text-white text-[13px] font-bold rounded-full px-5 py-2.5 shadow-pop animate-pop">{toast}</div>}
    </div>
  );
}

export default function CreatePage() {
  return <Suspense><CreateInner /></Suspense>;
}
