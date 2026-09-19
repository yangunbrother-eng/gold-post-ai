"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Topbar from "@/components/Topbar";
import UiIcon from "@/components/UiIcon";
import UiDialog from "@/components/UiDialog";
import PhonePreview from "@/components/PhonePreview";
import { useBrand, useContents, uid, todayStr } from "@/lib/store";
import { checkSimilarity, detectType, generatePost, rewritePost, suggestTitles } from "@/lib/ai";
import { AI_IMAGE_STYLES, buildGptPastePrompt, buildImagePrompt } from "@/lib/ai-image";
import { type HostAi, buildHostPrompt, openHostAi, splitPasted } from "@/lib/ai-host";
import { EDIT_ACTIONS, QUICK_TOPICS } from "@/lib/sample-data";
import type { ContentStatus, ContentType, GeneratedPost } from "@/lib/types";

const PROVIDERS: { id: HostAi; name: string; desc: string }[] = [
  { id: "chatgpt", name: "ChatGPT", desc: "새 탭에서 작성 후 가져오기" },
  { id: "gemini", name: "Gemini", desc: "새 탭에서 작성 후 가져오기" },
  { id: "auto", name: "사이트 AI", desc: "연결된 서버 AI로 작성" },
  { id: "template", name: "빠른 초안", desc: "기본 문장으로 바로 시작" },
];
const TYPE_MAP: Record<string, ContentType> = { "오늘의 시세": "시세", "고객 후기": "고객 후기", "실제 사례": "실제 사례", "상품 소개": "상품 소개", "FAQ": "FAQ", "이벤트": "이벤트", "영업 안내": "영업 안내", "방문 안내": "방문 안내", "정보성 콘텐츠": "정보성", "후기형 콘텐츠": "후기형", "문의 유도형": "문의 유도형", "자유 주제": "자유 주제" };
const SAFE_IMAGE = /^(https?:\/\/|data:image\/(png|jpeg|webp|gif);base64,)/i;
function CreateInner() {
  const params = useSearchParams();
  const { brand, tone, activeBranchId } = useBrand();
  const { items, upsert, loaded } = useContents();
  const [step, setStep] = useState(1);
  const [input, setInput] = useState(params.get("topic") ?? "");
  const [quick, setQuick] = useState("자유 주제");
  const [provider, setProvider] = useState<HostAi>("chatgpt");
  const [post, setPost] = useState<GeneratedPost | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);
  const [savedStamp, setSavedStamp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [hostPrompt, setHostPrompt] = useState("");
  const [pasted, setPasted] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [altTitles, setAltTitles] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [imgCount, setImgCount] = useState<1 | 2>(1);
  const [style, setStyle] = useState(AI_IMAGE_STYLES[0].id);
  const [imageBusy, setImageBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [checked, setChecked] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [payload, setPayload] = useState("");
  const [payloadBusy, setPayloadBusy] = useState(false);
  const [planDate, setPlanDate] = useState(todayStr());
  const opened = useRef("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const request = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const detected = TYPE_MAP[quick] && quick !== "자유 주제" ? TYPE_MAP[quick] : detectType(input || title);
  const similarity = useMemo(() => body ? checkSimilarity(body, items.filter((i) => i.id !== savedId).slice(0, 8)) : 0, [body, items, savedId]);
  const say = (message: string) => { setToast(message); if (toastTimer.current) clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(""), 4200); };
  const move = (next: number) => { setStep(next); setError(""); requestAnimationFrame(() => heading.current?.focus()); window.scrollTo({ top: 0, behavior: "auto" }); };
  const snapshot = JSON.stringify({ title, body, images });
  const dirty = !!(title || body || images.length) && snapshot !== savedStamp;
  useEffect(() => () => { request.current?.abort(); if (toastTimer.current) clearTimeout(toastTimer.current); }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    const guard = (e: MouseEvent) => {
      const anchor = (e.target as Element | null)?.closest?.("a");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
      if (!window.confirm("아직 저장하지 않은 글이 있어요. 저장하지 않고 이동할까요?")) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", guard, true);
    return () => { window.removeEventListener("beforeunload", warn); document.removeEventListener("click", guard, true); };
  }, [dirty]);
  useEffect(() => { setChecked(false); }, [title, body, images]);
  useEffect(() => {
    if (!loaded) return;
    const id = params.get("id") ?? params.get("reuse");
    const key = `${params.get("id") ?? ""}|${params.get("reuse") ?? ""}|${params.get("topic") ?? ""}|${params.get("section") ?? ""}`;
    if (opened.current === key) return;
    opened.current = key;
    if (!id) {
      setInput(params.get("topic") ?? ""); setTitle(""); setBody(""); setPost(null);
      setSavedId(null); setSavedStamp(""); setImages([]); setShowPaste(false);
      setStep(params.get("section") === "images" || window.location.hash === "#images" ? 2 : 1);
      return;
    }
    const item = items.find((i) => i.id === id);
    if (!item) { setError("이 글을 이 브라우저에서 찾지 못했어요. 보관함에서 다시 선택해 주세요."); return; }
    const urls = item.images.map((i) => i.copy).filter((u) => SAFE_IMAGE.test(u)).slice(0, 2);
    setTitle(item.title); setBody(item.body); setPost(item); setInput(item.title);
    setImages(urls); setImgCount(urls.length > 1 ? 2 : 1);
    setSavedId(params.get("reuse") ? null : item.id);
    setSavedStamp(params.get("reuse") ? "" : JSON.stringify({ title: item.title, body: item.body, images: urls }));
    setStep(2);
  }, [loaded, params, items]);
  const copy = async (text: string, message = "복사했어요.") => {
    try { await navigator.clipboard.writeText(text); say(message); return true; }
    catch { say("복사 권한이 없어요. 표시된 내용을 직접 선택해 복사해 주세요."); return false; }
  };
  const applyPost = (value: GeneratedPost) => {
    setPost(value); setTitle(value.title); setBody(value.body); setAltTitles([]); setError(""); move(2);
  };
  const basePost = (): GeneratedPost => ({ title, body, hook: post?.hook ?? body.split("\n")[0] ?? "", coreMessage: post?.coreMessage ?? "", cta: post?.cta ?? brand.defaultCta, imageCopy: post?.imageCopy ?? title.slice(0, 14), imageSubCopy: post?.imageSubCopy ?? brand.businessName, hashtags: post?.hashtags ?? [], type: post?.type ?? detected });
  const generate = async () => {
    if (!input.trim()) { setError("어떤 소식을 쓸지 먼저 한 줄로 적어 주세요."); return; }
    if (provider === "chatgpt" || provider === "gemini") {
      const prompt = buildHostPrompt(input, brand, tone, detected);
      setHostPrompt(prompt); setShowPaste(true); setError("");
      await copy(prompt, "작성 지시문을 복사했어요. 아래 버튼으로 AI를 열어 붙여넣어 주세요.");
      return;
    }
    if ((title || body) && !window.confirm("새 초안으로 현재 제목과 본문을 바꿀까요? 필요한 글은 먼저 저장해 주세요.")) return;
    setBusy(true); setError("");
    const controller = new AbortController(); request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 60000);
    try {
      if (provider === "template") { applyPost(generatePost(input, brand, tone, detected, Math.floor(Math.random() * 999))); say("기본 문장으로 초안을 만들었어요. 사실관계는 직접 확인해 주세요."); }
      else {
        const response = await fetch("/api/generate-post", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic: input, brand, tone, type: detected, provider: "auto" }), signal: controller.signal });
        const result = await response.json();
        if (!response.ok || !result.post || typeof result.post.title !== "string" || typeof result.post.body !== "string") throw new Error("generation");
        applyPost({ ...basePost(), ...result.post, hook: result.post.hook ?? "", coreMessage: result.post.coreMessage ?? "", cta: result.post.cta ?? brand.defaultCta, imageCopy: result.post.imageCopy ?? result.post.title.slice(0, 14), imageSubCopy: result.post.imageSubCopy ?? brand.businessName, hashtags: Array.isArray(result.post.hashtags) ? result.post.hashtags : [], type: detected });
        say("초안을 만들었어요. 내용을 검토해 주세요.");
      }
    } catch { setError("지금 사이트 AI가 응답하지 않아요. 다시 시도하거나 ChatGPT·빠른 초안으로 바꿔 주세요."); }
    finally { clearTimeout(timeout); setBusy(false); }
  };
  const applyPasted = (value = pasted) => {
    const parsed = splitPasted(value);
    if (!parsed.title || !parsed.body) { setError("제목과 본문이 함께 있는 결과를 붙여넣어 주세요."); return; }
    applyPost({ title: parsed.title, body: parsed.body, hook: parsed.body.split("\n")[0] ?? "", coreMessage: "", cta: brand.defaultCta, imageCopy: parsed.title.slice(0, 14), imageSubCopy: brand.businessName, hashtags: [], type: detected });
    setShowPaste(false); say("가져온 글을 적용했어요.");
  };
  const paste = async () => { try { const text = await navigator.clipboard.readText(); setPasted(text); applyPasted(text); } catch { setError("클립보드를 읽을 수 없어요. 아래 입력칸에 직접 붙여넣어 주세요."); } };
  const edit = (id: string) => {
    if (id === "regen") { move(1); say("주제와 작성 방식을 확인한 뒤 새로 작성해 주세요."); return; }
    if (id === "titles") { setAltTitles(suggestTitles(basePost())); return; }
    const next = rewritePost(basePost(), id, brand);
    setPost(next); setTitle(next.title); setBody(next.body); say("문장을 다듬었어요.");
  };
  const save = (status?: ContentStatus) => {
    if (!title.trim() && !body.trim()) { say("저장할 제목이나 본문을 입력해 주세요."); return false; }
    const original = items.find((i) => i.id === savedId);
    const id = savedId ?? uid();
    const legacy = original?.images?.filter((image) => !SAFE_IMAGE.test(image.copy)) ?? [];
    const success = upsert({ ...original, ...basePost(), id, title: title.trim() || "제목 없는 소식", body, status: status ?? original?.status ?? "AI 작성 완료", date: status === "발행 예정" ? planDate : original?.date ?? todayStr(), createdAt: original?.createdAt ?? todayStr(), images: images.length ? images.map((url, i) => ({ id: uid(), label: i === 0 ? "대표" : "추가", copy: url, bg: style, sub: "" })) : legacy, branchId: original?.branchId ?? activeBranchId });
    if (!success) { say("저장하지 못했어요. 글을 먼저 복사하고 브라우저 저장 공간을 확인해 주세요."); return false; }
    setSavedId(id); setSavedStamp(snapshot); say(status === "발행 예정" ? "발행 예정일을 기록했어요. 자동 발행은 아니에요." : "보관함에 저장했어요."); return true;
  };
  const generateImages = async (slot?: number) => {
    if (!title.trim() || !body.trim()) { say("먼저 제목과 본문을 작성해 주세요."); return; }
    setImageBusy(true); setError("");
    const controller = new AbortController(); request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 90000);
    try {
      const next = [...images];
      const slots = slot === undefined ? Array.from({ length: imgCount }, (_, i) => i) : [slot];
      for (const i of slots) {
        const response = await fetch("/api/generate-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: buildImagePrompt(title, body, style, (i + 1) as 1 | 2), count: 1 }), signal: controller.signal });
        const result = await response.json(); const url = result.images?.[0]?.url;
        if (!response.ok || typeof url !== "string" || !SAFE_IMAGE.test(url)) throw new Error("image");
        next[i] = url; setImages([...next]);
      }
      say("이미지를 만들었어요. 사용 전에 내용을 확인해 주세요.");
    } catch { setError("이미지를 만들지 못했어요. 다시 시도하거나 GPT용 이미지 지시문을 복사해 사용해 주세요."); }
    finally { clearTimeout(timeout); setImageBusy(false); }
  };
  const openSend = async () => {
    setSendOpen(true); setPayloadBusy(true); setPayload("");
    try {
      const prepared = await Promise.all(images.map(async (url, i) => {
        let dataUrl = url;
        try {
          if (!url.startsWith("data:")) {
            const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 10000);
            try {
              const response = await fetch(url, { signal: controller.signal });
              if (!response.ok) throw new Error("download");
              const blob = await response.blob();
              dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob); });
            } finally { clearTimeout(timer); }
          }
        } catch { /* Keep the original URL for extensions that fetch images directly. */ }
        return { slot: i + 1, url, dataUrl };
      }));
      setPayload(JSON.stringify({ source: "carrot-post-ai", version: "ext/1.2", action: "autofill-news", title, body, images: prepared, business: brand.businessName }, null, 2));
    } finally { setPayloadBusy(false); }
  };
  const hostName = provider === "gemini" ? "Gemini" : "ChatGPT";
  return <div className="ws-app"><Topbar title="소식 작성하기" sub="한 단계씩 따라가면 우리 매장 소식이 완성돼요." />
    <main className="ws-main">
      <nav className="ws-stepper" aria-label="소식 작성 단계">{["주제 선택", "글·이미지", "확인·발행"].map((label, i) => <button type="button" key={label} className={`ws-step ${step === i + 1 ? "is-active" : ""} ${step > i + 1 ? "is-done" : ""}`} aria-current={step === i + 1 ? "step" : undefined} disabled={busy || imageBusy || (i === 2 && (!title.trim() || !body.trim()))} onClick={() => move(i + 1)}><span>{i + 1}</span>{label}</button>)}</nav>
      {error && <div className="ws-note ws-note-error" role="alert"><UiIcon name="info" size={18} />{error}</div>}
      {step === 1 && <section className="ws-panel ws-compose">
        <h2 ref={heading} tabIndex={-1}>어떤 이야기를 전할까요?</h2><p className="ws-helper">주제를 한 줄로 적거나 아래에서 골라 주세요.</p>
        <div className="ws-form-group"><label htmlFor="post-topic" className="ws-label">오늘의 주제</label><textarea id="post-topic" className="ws-input" rows={4} value={input} onChange={(e) => setInput(e.target.value)} placeholder="예) 끊어진 금목걸이도 매입할 수 있다는 안내를 쓰고 싶어요." /></div>
        <div className="ws-form-group"><span className="ws-label">빠른 주제 선택</span><div className="ws-chips">{QUICK_TOPICS.map((q) => <button key={q} type="button" aria-pressed={quick === q} className={`ws-chip ${quick === q ? "is-active" : ""}`} onClick={() => { setQuick(q); if (!input.trim() && q !== "자유 주제") setInput(q); }}>{q}</button>)}</div></div>
        <div className="ws-form-group"><span className="ws-label">어떻게 작성할까요?</span><div className="ws-provider-grid">{PROVIDERS.map((p) => <button type="button" key={p.id} aria-pressed={provider === p.id} className={`ws-provider ${provider === p.id ? "is-active" : ""}`} onClick={() => { setProvider(p.id); setShowPaste(false); }}><strong>{p.name}</strong><small>{p.desc}</small></button>)}</div></div>
        <p className="ws-helper ws-form-group">{brand.businessName} · {tone} <Link href="/brand" className="ws-text-link">매장 정보 확인<UiIcon name="chevron" size={13} /></Link></p>
        <button type="button" className="ws-button ws-button-primary ws-button-wide" disabled={busy} onClick={() => void generate()}><UiIcon name="spark" />{busy ? "초안을 만들고 있어요…" : provider === "chatgpt" || provider === "gemini" ? `${hostName} 작성 지시문 만들기` : provider === "template" ? "빠른 초안 만들기" : "사이트 AI로 작성하기"}</button>
        <button type="button" className="ws-text-link ws-button-wide" onClick={() => move(2)}>AI 없이 직접 작성할게요<UiIcon name="arrow" size={16} /></button>
        {showPaste && (provider === "chatgpt" || provider === "gemini") && <div className="ws-form-group ws-stack">
          <div className="ws-note"><UiIcon name="info" size={18} /><span>① 지시문 복사 → ② {hostName}에 붙여넣고 전송 → ③ 결과를 아래로 가져오세요. 이 사이트가 구독 계정에 직접 접속하는 방식은 아니에요.</span></div>
          <div className="ws-secondary-actions"><button type="button" className="ws-button" onClick={() => void copy(hostPrompt)}><UiIcon name="copy" size={16} />지시문 복사</button><button type="button" className="ws-button" onClick={() => openHostAi(provider, hostPrompt)}>{hostName} 열기<UiIcon name="external" size={16} /></button></div>
          <details className="ws-disclosure"><summary>복사가 안 되나요? 지시문 직접 보기</summary><textarea className="ws-input" value={hostPrompt} readOnly rows={6} aria-label="직접 복사할 작성 지시문" /></details>
          <label className="ws-label" htmlFor="pasted-result">작성 결과 붙여넣기</label><textarea id="pasted-result" className="ws-input" rows={6} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder={"제목: …\n본문:\n…"} />
          <div className="ws-secondary-actions"><button className="ws-button" type="button" onClick={() => void paste()}>클립보드에서 가져오기</button><button className="ws-button ws-button-primary" type="button" onClick={() => applyPasted()}>입력한 글 적용<UiIcon name="arrow" size={16} /></button></div>
        </div>}
      </section>}
      {step === 2 && <>
        <section className="ws-panel ws-compose"><h2 ref={heading} tabIndex={-1}>우리 매장답게 다듬어 주세요.</h2><p className="ws-helper">제목과 본문을 직접 수정할 수 있어요.</p>
          <div className="ws-form-group"><div className="ws-form-heading"><label className="ws-label" htmlFor="post-title">소식 제목</label><span>{title.length}자</span></div><input id="post-title" className="ws-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="고객의 관심을 끄는 제목" /></div>
          <div className="ws-form-group"><div className="ws-form-heading"><label className="ws-label" htmlFor="post-body">소식 본문</label><span>{body.length.toLocaleString()}자</span></div><textarea id="post-body" className="ws-input" rows={12} value={body} onChange={(e) => setBody(e.target.value)} placeholder="고객에게 전하고 싶은 이야기를 적어 주세요." /></div>
          {similarity >= 55 && <div className="ws-note ws-form-group"><UiIcon name="info" size={17} />최근 글과 문장이 비슷해요. 같은 표현이 반복되는지 확인해 주세요.</div>}
          <details className="ws-disclosure"><summary>문장 다듬기 · 다른 제목 제안</summary><div className="ws-chips">{EDIT_ACTIONS.map((a) => <button className="ws-chip" type="button" key={a.id} disabled={!body.trim()} onClick={() => edit(a.id)}>{a.label}</button>)}</div>{altTitles.map((t) => <button type="button" key={t} className="ws-button ws-button-wide ws-form-group" onClick={() => { setTitle(t); setAltTitles([]); }}>{t}</button>)}</details>
          <div className="ws-editor-actions"><button className="ws-button" type="button" onClick={() => save("초안")}><UiIcon name="library" size={16} />초안 저장</button><button className="ws-button" type="button" disabled={!body.trim()} onClick={() => void copy(`${title}\n\n${body}`)}><UiIcon name="copy" size={16} />글 복사</button></div>
        </section>
        <section id="images" className="ws-panel ws-compose"><div className="ws-section-head"><h2>함께 올릴 이미지</h2><span className="ws-count">선택 · 최대 2장</span></div><p className="ws-helper">기존 이미지 생성 기능을 사용해요. 사진 없이 다음 단계로 넘어가도 괜찮아요.</p>
          <div className="ws-form-group"><label htmlFor="image-style" className="ws-label">이미지 분위기</label><select id="image-style" className="ws-input" value={style} onChange={(e) => setStyle(e.target.value)}>{AI_IMAGE_STYLES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div className="ws-form-group ws-secondary-actions">{([1, 2] as const).map((n) => <button type="button" key={n} className={`ws-chip ${imgCount === n ? "is-active" : ""}`} aria-pressed={imgCount === n} disabled={imageBusy} onClick={() => { setImgCount(n); setImages((current) => current.slice(0, n)); }}>{n}장</button>)}<button type="button" className="ws-button" disabled={imageBusy || !title.trim() || !body.trim()} onClick={() => void generateImages()}><UiIcon name="image" size={16} />{imageBusy ? "이미지 생성 중…" : "이미지 만들기"}</button></div>
          <div className="ws-image-grid">{images.map((url, i) => <div key={`${i}-${url.slice(-20)}`} className="ws-image-tile"><img src={url} alt={`소식 이미지 ${i + 1}`} /><div><button type="button" disabled={imageBusy} onClick={() => void generateImages(i)}>다시 생성</button><a href={url} target="_blank" rel="noopener noreferrer">원본<UiIcon name="external" size={12} /></a><button type="button" disabled={imageBusy} aria-label={`이미지 ${i + 1} 제거`} onClick={() => setImages((current) => current.filter((_, idx) => idx !== i))}><UiIcon name="close" size={15} /></button></div></div>)}</div>
          <button type="button" className="ws-text-link" onClick={() => void copy(buildGptPastePrompt(title || input, body || input, imgCount, AI_IMAGE_STYLES.find((s) => s.id === style)?.name ?? ""), "이미지 작성 지시문을 복사했어요.")}>GPT용 이미지 지시문 복사<UiIcon name="copy" size={15} /></button>
        </section>
        <button type="button" className="ws-button ws-button-primary ws-button-wide" disabled={!title.trim() || !body.trim() || imageBusy} onClick={() => move(3)}>미리 보고 마무리하기<UiIcon name="arrow" /></button>
        <p className="ws-helper">초안을 저장하면 보관함에서 이어 쓸 수 있어요. 자동 저장은 아니에요.</p>
      </>}
      {step === 3 && <>
        <section className="ws-panel ws-compose"><h2 ref={heading} tabIndex={-1}>발행 전에 한 번 확인해 주세요.</h2><p className="ws-helper">아래는 소식 미리보기예요. 실제 당근 화면과 다를 수 있어요.</p><div className="ws-preview ws-form-group"><PhonePreview title={title} body={body} bizName={brand.businessName} time="미리보기" imageCopy="" imageSub="" bg={brand.color} logo={brand.logoUrl} logoText={brand.logoText} aiImages={images} /></div>
          <div className="ws-checklist"><label><input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} /><span>시세·거래 사례·연락처가 정확한지 확인했어요. 생성한 이미지를 실제 매장·고객 사진으로 오해하게 쓰지 않아요.</span></label></div>
          <div className="ws-editor-actions"><button className="ws-button" onClick={() => move(2)}>다시 수정</button><button className="ws-button" disabled={!checked} onClick={() => save("검수 완료")}><UiIcon name="check" size={16} />검수 완료로 저장</button></div>
          <button type="button" className="ws-button ws-button-primary ws-button-wide ws-form-group" disabled={!checked || payloadBusy} onClick={() => void openSend()}>당근 발행 준비<UiIcon name="external" size={17} /></button><p className="ws-helper ws-form-group">실제 발행은 당근에서 내용을 확인하고 등록해야 완료돼요.</p>
        </section>
        <section className="ws-panel"><label htmlFor="plan-date" className="ws-label">나중에 올릴 예정인가요?</label><p className="ws-helper">예정일을 캘린더에 기록해요. 자동 예약 발행 기능은 아니에요.</p><div className="ws-secondary-actions ws-form-group"><input className="ws-input" id="plan-date" type="date" value={planDate} min={todayStr()} onChange={(e) => setPlanDate(e.target.value)} /><button className="ws-button ws-button-wide" disabled={!checked || !planDate || planDate < todayStr()} onClick={() => save("발행 예정")}><UiIcon name="calendar" size={17} />발행 예정일 저장</button></div></section>
      </>}
    </main>
    <UiDialog open={sendOpen} title="당근 발행 준비" onClose={() => setSendOpen(false)}>
      <div className="ws-note"><UiIcon name="info" size={18} />이 창을 열거나 복사해도 글이 자동 발행되지는 않아요.</div>
      <div><h3 className="ws-label">1. 글을 복사하세요</h3><button type="button" className="ws-button ws-button-wide" onClick={() => void copy(`${title}\n\n${body}`, "제목과 본문을 복사했어요.")}><UiIcon name="copy" size={17} />제목·본문 복사</button></div>
      <div><h3 className="ws-label">2. 당근에서 붙여넣고 등록하세요</h3><a href="https://www.daangn.com/kr/business" target="_blank" rel="noopener noreferrer" className="ws-button ws-button-primary ws-button-wide">당근 비즈니스 열기<UiIcon name="external" size={17} /></a><p className="ws-helper ws-form-group">모바일에서도 글을 직접 붙여넣을 수 있어요. 이미지는 따로 첨부하고, 등록 전 최종 확인해 주세요.</p></div>
      <details className="ws-disclosure"><summary>PC 확장 프로그램으로 제목·본문·이미지 전달</summary><p className="ws-helper">연결된 Chrome 확장 프로그램이 있어야 해요. 복사한 뒤 당근 작성 화면의 ‘AI 글 채우기’를 누르세요. 이미지가 첨부됐는지도 직접 확인해 주세요.</p><button type="button" className="ws-button ws-button-wide ws-form-group" disabled={payloadBusy || !payload} onClick={() => void copy(payload, "확장 프로그램용 데이터를 복사했어요.")}>{payloadBusy ? "이미지 데이터 준비 중…" : "확장 프로그램용 데이터 복사"}</button><p className="ws-helper">{images.length}장 포함 · 외부 이미지 접근이 막히면 별도로 첨부해야 할 수 있어요.</p></details>
    </UiDialog>
    {toast && <div className="ws-toast" role="status">{toast}</div>}
  </div>;
}
export default function CreatePage() { return <Suspense fallback={<div className="ws-empty">작성 화면을 준비하고 있어요.</div>}><CreateInner /></Suspense>; }
