"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Topbar from "@/components/Topbar";
import Icon from "@/components/Icon";
import UiIcon from "@/components/UiIcon";
import UiDialog from "@/components/UiDialog";
import PhonePreview from "@/components/PhonePreview";
import ImageStudio from "@/components/ImageStudio";
import { newImageDraft, SLOT_NAMES, type ImageSettings, type ImageStudioDraft } from "@/lib/image-studio";
import { useBrand, useContents, uid, todayStr } from "@/lib/store";
import { checkSimilarity, detectType, generatePost, rewritePost, suggestTitles } from "@/lib/ai";
import { type HostAi, buildHostPrompt, openHostAi, splitPasted } from "@/lib/ai-host";
import { EDIT_ACTIONS, QUICK_TOPICS } from "@/lib/sample-data";
import type { ContentItem, ContentStatus, ContentType, GeneratedPost } from "@/lib/types";

const PROVIDERS: { id: HostAi; name: string; desc: string }[] = [
  { id: "chatgpt", name: "ChatGPT", desc: "창 열기 · 확장 연결 시 자동 전송" },
  { id: "gemini", name: "Gemini", desc: "창 열기 · 확장 연결 시 자동 전송" },
  { id: "auto", name: "사이트 AI", desc: "연결된 서버 AI로 작성" },
  { id: "template", name: "빠른 초안", desc: "기본 문장으로 바로 시작" },
];
const TYPE_MAP: Record<string, ContentType> = { "오늘의 시세": "시세", "고객 후기": "고객 후기", "실제 사례": "실제 사례", "상품 소개": "상품 소개", "FAQ": "FAQ", "이벤트": "이벤트", "영업 안내": "영업 안내", "방문 안내": "방문 안내", "정보성 콘텐츠": "정보성", "후기형 콘텐츠": "후기형", "문의 유도형": "문의 유도형", "자유 주제": "자유 주제" };
const TONES = ["친근한 상담형", "전문가형", "정보 전달형", "지역 친화형", "부드러운 홍보형", "광고 느낌 최소화"];
const LENGTHS = ["짧게", "보통", "자세히"];
const SOURCES = [
  { id: "direct", label: "직접 주제 입력" },
  { id: "naver", label: "네이버에서 찾기" },
  { id: "youtube", label: "유튜브에서 찾기" },
  { id: "image", label: "이미지 예시 참고" },
] as const;
const POST_TYPES: { id: string; type: ContentType }[] = [
  { id: "정보형", type: "정보성" },
  { id: "후기형", type: "후기형" },
  { id: "소개형", type: "상품 소개" },
  { id: "상담 유도형", type: "문의 유도형" },
  { id: "이벤트/안내형", type: "이벤트" },
];
const IMAGE_EXAMPLES = [
  { copy: "오늘 금값 확인하세요", bg: "#111111", prompt: "오늘 금값 기준으로 지금 팔아도 되는지 알려주는 글" },
  { copy: "이 작은 조각도 될까요?", bg: "#FF6F0F", prompt: "작은 금 조각도 매입되는지 궁금해하는 고객용 글" },
  { copy: "오늘 정상 영업합니다", bg: "#14324F", prompt: "오늘 정상 영업한다는 안내 글" },
  { copy: "돌반지 얼마일까?", bg: "#5B3DF5", prompt: "오래된 돌반지 가격 문의 고객용 글" },
];
type StudioContent = ContentItem & { imageStudio?: ImageSettings };
const readTags = (text: string) => Array.from(new Set(text.match(/#[^\s#]+/g) || []));
const stamp = (title: string, body: string, tags: string[], draft: ImageStudioDraft) => JSON.stringify({ title, body, tags, settings: draft.settings, slots: draft.slots });

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
  const [tags, setTags] = useState<string[]>([]);
  const [studio, setStudio] = useState<ImageStudioDraft>(() => newImageDraft());
  const [savedId, setSavedId] = useState<string | null>(null);
  const [savedStamp, setSavedStamp] = useState("");
  const [busy, setBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [error, setError] = useState("");
  const [hostPrompt, setHostPrompt] = useState("");
  const [pasted, setPasted] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [altTitles, setAltTitles] = useState<string[]>([]);
  const [toast, setToast] = useState("");
  const [checked, setChecked] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [payload, setPayload] = useState("");
  const [payloadBusy, setPayloadBusy] = useState(false);
  const [toneSel, setToneSel] = useState("");
  const [lenSel, setLenSel] = useState("보통");
  const [sourceTab, setSourceTab] = useState<"direct" | "naver" | "youtube" | "image">("direct");
  const [postType, setPostType] = useState<ContentType | "">("");
  const [naverKw, setNaverKw] = useState("");
  const [naverText, setNaverText] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const effectiveTone = toneSel || tone;
  const log = (message: string) => {
    const t = new Date();
    const stamp = [t.getHours(), t.getMinutes(), t.getSeconds()].map(n => String(n).padStart(2, "0")).join(":");
    setLogs(prev => [...prev.slice(-49), `[${stamp}] ${message}`]);
  };
  const [planDate, setPlanDate] = useState(todayStr());
  const opened = useRef("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const request = useRef<AbortController | null>(null);
  const main = useRef<HTMLElement>(null);
  const images = useMemo(() => studio.slots.slice(0, studio.settings.count).map(s => s.url).filter(Boolean), [studio.slots, studio.settings.count]);
  const detected: ContentType = postType || (TYPE_MAP[quick] && quick !== "자유 주제" ? TYPE_MAP[quick] : detectType(input || title));
  const similarity = useMemo(() => body ? checkSimilarity(body, items.filter(i => i.id !== savedId).slice(0, 8)) : 0, [body, items, savedId]);
  const say = (message: string) => { setToast(message); if (toastTimer.current) clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(""), 4200); };
  const move = (next: number) => { if (busy || imageBusy) return; setStep(next); setError(""); requestAnimationFrame(() => main.current?.focus()); window.scrollTo({ top: 0, behavior: "auto" }); };
  const snapshot = stamp(title, body, tags, studio);
  const dirty = !!(title || body || images.length) && snapshot !== savedStamp;
  const ready = !!title.trim() && !!body.trim();
  const exportText = () => `${title}\n\n${body}${tags.some(t => !body.includes(t)) ? `\n\n${tags.filter(t => !body.includes(t)).join(" ")}` : ""}`;

  useEffect(() => () => { request.current?.abort(); if (toastTimer.current) clearTimeout(toastTimer.current); }, []);
  useEffect(() => {
    if (!dirty && !imageBusy) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    const guard = (e: MouseEvent) => {
      const anchor = (e.target as Element | null)?.closest?.("a");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
      if (imageBusy || !window.confirm("아직 저장하지 않은 작업이 있어요. 저장하지 않고 이동할까요?")) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener("beforeunload", warn); document.addEventListener("click", guard, true);
    return () => { window.removeEventListener("beforeunload", warn); document.removeEventListener("click", guard, true); };
  }, [dirty, imageBusy]);
  useEffect(() => { setChecked(false); }, [title, body, tags, images]);
  useEffect(() => {
    if (!loaded) return;
    const id = params.get("id") ?? params.get("reuse");
    const key = `${params.get("id") ?? ""}|${params.get("reuse") ?? ""}|${params.get("topic") ?? ""}|${params.get("section") ?? ""}`;
    if (opened.current === key) return;
    opened.current = key;
    if (!id) {
      const t = params.get("topic") ?? "";
      if (t) setSourceTab("direct");
      setInput(t); setTitle(""); setBody(""); setTags([]); setPost(null);
      setSavedId(null); setSavedStamp(""); setStudio(newImageDraft()); setShowPaste(false);
      setStep(params.get("section") === "images" || window.location.hash === "#images" ? 3 : 1); return;
    }
    const item = items.find(i => i.id === id) as StudioContent | undefined;
    if (!item) { setError("이 글을 이 브라우저에서 찾지 못했어요. 보관함에서 다시 선택해 주세요."); return; }
    const draft = newImageDraft(item.imageStudio, item.images);
    const hashtags = item.hashtags?.length ? item.hashtags : readTags(item.body);
    setTitle(item.title); setBody(item.body); setTags(hashtags); setPost(item); setInput(item.title); setStudio(draft); setPlanDate(item.date);
    setSavedId(params.get("reuse") ? null : item.id);
    setSavedStamp(params.get("reuse") ? "" : stamp(item.title, item.body, hashtags, draft));
    setStep(params.get("section") === "images" ? 3 : 2);
  }, [loaded, params, items]);
  const copy = async (text: string, message = "복사했어요.") => {
    try { await navigator.clipboard.writeText(text); say(message); return true; }
    catch { say("복사 권한이 없어요. 표시된 내용을 직접 선택해 복사해 주세요."); return false; }
  };
  const applyPost = (value: GeneratedPost) => {
    setPost(value); setTitle(value.title); setBody(value.body); setTags(value.hashtags?.length ? value.hashtags : readTags(value.body)); setAltTitles([]); setError("");
    setStep(2); requestAnimationFrame(() => main.current?.focus()); window.scrollTo({ top: 0 });
  };
  const basePost = (): GeneratedPost => ({ title, body, hook: post?.hook ?? body.split("\n")[0] ?? "", coreMessage: post?.coreMessage ?? "", cta: post?.cta ?? brand.defaultCta, imageCopy: post?.imageCopy ?? title.slice(0, 14), imageSubCopy: post?.imageSubCopy ?? brand.businessName, hashtags: tags, type: post?.type ?? detected });
  const generate = async () => {
    if (!input.trim()) { setError("어떤 소식을 쓸지 먼저 한 줄로 적어 주세요."); return; }
    log(`초안 작성 시작 (방식: ${provider}, 말투: ${effectiveTone}, 분량: ${lenSel})`);
    if (provider === "chatgpt" || provider === "gemini") {
      const prompt = buildHostPrompt(input, brand, effectiveTone, detected);
      const name = provider === "gemini" ? "Gemini" : "ChatGPT";
      setHostPrompt(prompt); setShowPaste(true); setError("");
      const clipboard = navigator.clipboard?.writeText(prompt).then(() => true).catch(() => false) ?? Promise.resolve(false);
      openHostAi(provider, prompt);
      const copied = await clipboard;
      say(`${name} 열기를 요청했어요. 자동 전송이 안 되면 ${copied ? "복사된 지시문을 붙여넣어" : "지시문을 다시 복사해"} 전송해 주세요.`); log(`${name} 지시문 전달, 결과 붙여넣기 대기 중`); return;
    }
    if ((title || body) && !window.confirm("새 초안으로 현재 제목과 본문을 바꿀까요? 필요한 글은 먼저 저장해 주세요.")) return;
    setBusy(true); setError("");
    const controller = new AbortController(); request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 60000);
    try {
      if (provider === "template") { let p = generatePost(input, brand, effectiveTone, detected, Math.floor(Math.random() * 999)); if (lenSel !== "보통") p = rewritePost(p, lenSel === "짧게" ? "short" : "long", brand); applyPost(p); log(`빠른 초안 완성 (말투: ${effectiveTone}, 분량: ${lenSel})`); say("기본 문장으로 초안을 만들었어요. 사실관계는 직접 확인해 주세요."); }
      else {
        const response = await fetch("/api/generate-post", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic: input, brand, tone: effectiveTone, type: detected, provider: "auto" }), signal: controller.signal });
        const result = await response.json();
        if (!response.ok || !result.post || typeof result.post.title !== "string" || typeof result.post.body !== "string") throw new Error("generation");
        let p = { ...basePost(), ...result.post, hook: result.post.hook ?? "", coreMessage: result.post.coreMessage ?? "", cta: result.post.cta ?? brand.defaultCta, imageCopy: result.post.imageCopy ?? result.post.title.slice(0, 14), imageSubCopy: result.post.imageSubCopy ?? brand.businessName, hashtags: Array.isArray(result.post.hashtags) ? result.post.hashtags : [], type: detected };
        if (lenSel !== "보통") p = rewritePost(p, lenSel === "짧게" ? "short" : "long", brand);
        applyPost(p);
        log(`사이트 AI 초안 완성 (말투: ${effectiveTone}, 분량: ${lenSel})`);
        say("초안을 만들었어요. 내용을 검토해 주세요.");
      }
    } catch { setError("지금 사이트 AI가 응답하지 않아요. 다시 시도하거나 ChatGPT·빠른 초안으로 바꿔 주세요."); log("사이트 AI 응답 실패"); }
    finally { clearTimeout(timeout); setBusy(false); }
  };
  const applyPasted = (value = pasted) => {
    const parsed = splitPasted(value);
    if (!parsed.title || !parsed.body) { setError("제목과 본문이 함께 있는 결과를 붙여넣어 주세요."); return; }
    applyPost({ title: parsed.title, body: parsed.body, hook: parsed.body.split("\n")[0] ?? "", coreMessage: "", cta: brand.defaultCta, imageCopy: parsed.title.slice(0, 14), imageSubCopy: brand.businessName, hashtags: readTags(parsed.body), type: detected });
    setShowPaste(false); log("외부 작성 결과 적용됨"); say("가져온 글을 적용했어요.");
  };
  const paste = async () => { try { const text = await navigator.clipboard.readText(); setPasted(text); applyPasted(text); } catch { setError("클립보드를 읽을 수 없어요. 아래 입력칸에 직접 붙여넣어 주세요."); } };
  const edit = (id: string) => {
    if (id === "regen") { move(1); say("주제와 작성 방식을 확인한 뒤 새로 작성해 주세요."); return; }
    if (id === "titles") { setAltTitles(suggestTitles(basePost())); return; }
    const next = rewritePost(basePost(), id, brand); setPost(next); setTitle(next.title); setBody(next.body); setTags(next.hashtags); say("문장을 다듬었어요.");
  };
  const save = (status?: ContentStatus) => {
    if (!title.trim() && !body.trim()) { say("저장할 제목이나 본문을 입력해 주세요."); return false; }
    const original = items.find(i => i.id === savedId);
    const id = savedId ?? uid();
    const item: StudioContent = { ...original, ...basePost(), id, title: title.trim() || "제목 없는 소식", body, status: status ?? original?.status ?? "초안", date: status === "발행 예정" ? planDate : original?.date ?? todayStr(), createdAt: original?.createdAt ?? todayStr(),
      images: studio.slots.slice(0, studio.settings.count).flatMap((slot, i) => slot.url ? [{ id: `${id}-image-${i}`, slot: i, label: SLOT_NAMES[i], copy: slot.url, bg: studio.settings.type, sub: "", prompt: slot.prompt, source: slot.source, signature: slot.signature }] : []),
      imageStudio: studio.settings, branchId: original?.branchId ?? activeBranchId };
    const success = upsert(item);
    if (!success) { say("저장하지 못했어요. 글과 이미지를 내려받고 브라우저 저장 공간을 확인해 주세요."); return false; }
    setSavedId(id); setSavedStamp(snapshot); log(`보관함 저장 (${status ?? "초안"})`); say(status === "발행 예정" ? "발행 예정일을 기록했어요. 자동 발행은 아니에요." : "글과 이미지를 보관함에 저장했어요."); return true;
  };
  const openSend = async () => {
    setSendOpen(true); setPayloadBusy(true); setPayload("");
    log("발행 준비 시작 (이미지 데이터 변환 중)");
    try {
      const prepared = await Promise.all(images.map(async (url, i) => {
        let dataUrl = url;
        try {
          if (!url.startsWith("data:")) {
            const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 10000);
            try {
              const response = await fetch(url, { signal: controller.signal }); if (!response.ok) throw new Error("download");
              const blob = await response.blob();
              dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob); });
            } finally { clearTimeout(timer); }
          }
        } catch { /* Extensions can fetch the original URL when CORS blocks conversion. */ }
        return { slot: i + 1, url, dataUrl };
      }));
      setPayload(JSON.stringify({ source: "carrot-post-ai", version: "ext/1.2", action: "autofill-news", title, body: exportText().slice(title.length).trim(), images: prepared, business: brand.businessName }, null, 2));
      log(`전송 데이터 준비 완료 (이미지 ${prepared.length}장)`);
    } finally { setPayloadBusy(false); }
  };
  const hostName = provider === "gemini" ? "Gemini" : "ChatGPT";
  return <div className="ws-app"><Topbar title="소식 작성하기" sub="주제부터 이미지까지, 우리 매장 소식을 한 단계씩 완성해요." />
    <main className="ws-main" ref={main} tabIndex={-1} id="main-content">
      <nav className="ws-stepper" style={{ gridTemplateColumns: "repeat(4,minmax(0,1fr))" }} aria-label="소식 작성 단계">{["주제", "초안", "이미지", "발행"].map((label, i) => <button type="button" key={label} className={`ws-step ${step === i + 1 ? "is-active" : ""} ${step > i + 1 ? "is-done" : ""}`} aria-current={step === i + 1 ? "step" : undefined} disabled={busy || imageBusy || (i === 3 && !ready)} onClick={() => move(i + 1)}><span>{i + 1}</span>{label}</button>)}</nav>
      {error && <div className="ws-note ws-note-error" role="alert"><UiIcon name="info" size={18} />{error}</div>}
      {step === 1 && <section className="ws-panel ws-compose">
        <h2>어떤 이야기를 전할까요?</h2><p className="ws-helper">찾는 방식과 글 유형을 고르면 초안이 그에 맞게 만들어져요.</p>
        <div className="ws-form-group" role="group" aria-label="초안 찾기 방식"><span className="ws-label">초안 찾기 방식</span><div className="ws-chips">{SOURCES.map(s => <button key={s.id} type="button" aria-pressed={sourceTab === s.id} className={`ws-chip ${sourceTab === s.id ? "is-active" : ""}`} onClick={() => setSourceTab(s.id)}>{s.label}</button>)}</div></div>
        {sourceTab === "direct" && <>
          <div className="ws-form-group"><label htmlFor="post-topic" className="ws-label">오늘의 주제</label><textarea id="post-topic" className="ws-input" rows={4} value={input} onChange={e => setInput(e.target.value)} placeholder="예) 끊어진 금목걸이도 매입할 수 있다는 안내를 쓰고 싶어요." /></div>
          <div className="ws-form-group" role="group" aria-labelledby="quick-topic-title"><span id="quick-topic-title" className="ws-label">빠른 주제 선택</span><div className="ws-chips">{QUICK_TOPICS.map(q => <button key={q} type="button" aria-pressed={quick === q} className={`ws-chip ${quick === q ? "is-active" : ""}`} onClick={() => { setQuick(q); if (!input.trim() && q !== "자유 주제") setInput(q); }}>{q}</button>)}</div></div>
        </>}
        {sourceTab === "naver" && <div className="ws-form-group ws-stack">
          <span className="ws-label">네이버에서 찾기</span>
          <p className="ws-helper">키워드로 네이버 검색을 열고, 참고할 글을 복사해 아래에 붙여넣으세요. 그대로 베끼지 않고 우리 말투로 다시 씁니다.</p>
          <div className="ws-secondary-actions"><input className="ws-input" value={naverKw} onChange={e => setNaverKw(e.target.value)} placeholder="검색어 (예: 금니 매입)" aria-label="네이버 검색어" /><button type="button" className="ws-button" onClick={() => window.open(`https://search.naver.com/search.naver?where=view&query=${encodeURIComponent(naverKw.trim() || input.trim() || "금매입")}`, "_blank", "noopener")}>네이버 검색 열기<UiIcon name="external" size={16} /></button></div>
          <label className="ws-label" htmlFor="naver-paste">참고 글 붙여넣기</label>
          <textarea id="naver-paste" className="ws-input" rows={5} value={naverText} onChange={e => setNaverText(e.target.value)} placeholder="제목과 본문을 함께 붙여넣으세요." />
          <button type="button" className="ws-button ws-button-primary" disabled={!naverText.trim()} onClick={() => { log("네이버 참고글 적용"); applyPasted(naverText); }}>가져온 글 적용<UiIcon name="arrow" size={16} /></button>
        </div>}
        {sourceTab === "youtube" && <div className="ws-form-group">
          <Link href="/trends" target="_blank" rel="noopener noreferrer" className="ws-button ws-button-wide ws-form-group" aria-describedby="youtube-topic-help"><Icon name="youtube" size={18} />유튜브에서 주제 찾기<UiIcon name="external" size={16} /></Link><p id="youtube-topic-help" className="ws-helper">새 탭에서 영상과 댓글을 살펴보세요. 작성 중인 화면은 그대로 남아요.</p></div>}
        {sourceTab === "image" && <div className="ws-form-group" role="group" aria-label="이미지 예시 참고"><span className="ws-label">이미지 예시 참고</span><p className="ws-helper">맘에 드는 대표 문구를 고르면 그에 맞는 주제로 시작합니다.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{IMAGE_EXAMPLES.map(ex => <button key={ex.copy} type="button" className="ws-button" style={{ padding: 0, overflow: "hidden" }} onClick={() => { setInput(ex.prompt); setQuick("자유 주제"); setSourceTab("direct"); log(`이미지 예시 선택: ${ex.copy}`); say("주제를 넣었어요. 아래에서 작성해 주세요."); }}><span style={{ display: "block", background: ex.bg, color: "#fff", fontWeight: 900, fontSize: 15, padding: "22px 10px" }}>{ex.copy}</span><span style={{ display: "block", fontSize: 11, padding: "8px", opacity: 0.65 }}>이 주제로 시작</span></button>)}</div></div>}
        <div className="ws-form-group" role="group" aria-label="글 유형"><span className="ws-label">글 유형</span><div className="ws-chips">{POST_TYPES.map(p => <button key={p.id} type="button" aria-pressed={postType === p.type} className={`ws-chip ${postType === p.type ? "is-active" : ""}`} onClick={() => setPostType(postType === p.type ? "" : p.type)}>{p.id}</button>)}</div>{!postType && <p className="ws-helper">고르지 않으면 주제에 맞게 자동으로 정해져요.</p>}</div>
        <div className="ws-form-group"><span className="ws-label">어떻게 작성할까요?</span><div className="ws-provider-grid">{PROVIDERS.map(p => <button type="button" key={p.id} aria-pressed={provider === p.id} className={`ws-provider ${provider === p.id ? "is-active" : ""}`} onClick={() => { setProvider(p.id); setShowPaste(false); }}><strong>{p.name}</strong><small>{p.desc}</small></button>)}</div></div>
        <div className="ws-form-group ws-secondary-actions">
          <div style={{ flex: 1 }}><label className="ws-label" htmlFor="tone-sel">말투</label><select id="tone-sel" className="ws-input" value={toneSel || tone} onChange={e => setToneSel(e.target.value)}>{TONES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
          <div style={{ flex: 1 }}><label className="ws-label" htmlFor="len-sel">분량</label><select id="len-sel" className="ws-input" value={lenSel} onChange={e => setLenSel(e.target.value)}>{LENGTHS.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
        </div>
        <p className="ws-helper ws-form-group">{brand.businessName} · {tone} <Link href="/brand" className="ws-text-link">매장 정보 확인<UiIcon name="chevron" size={13} /></Link></p>
        <button type="button" className="ws-button ws-button-primary ws-button-wide" disabled={busy} onClick={() => void generate()}><UiIcon name="spark" />{busy ? "초안을 만들고 있어요…" : provider === "chatgpt" || provider === "gemini" ? `${hostName} 작성 지시문 만들기` : provider === "template" ? "빠른 초안 만들기" : "사이트 AI로 작성하기"}</button>
        <button type="button" className="ws-text-link ws-button-wide" onClick={() => move(2)}>AI 없이 직접 작성할게요<UiIcon name="arrow" size={16} /></button>
        {showPaste && (provider === "chatgpt" || provider === "gemini") && <div className="ws-form-group ws-stack"><div className="ws-note"><UiIcon name="info" size={18} /><span>{hostName}에서 작성이 끝나면 결과를 복사해 아래로 가져오세요. 자동 입력·전송은 연결된 확장프로그램이 담당해요.</span></div><button type="button" className="ws-button ws-button-wide" onClick={() => void copy(hostPrompt)}><UiIcon name="copy" size={16} />지시문 다시 복사</button><details className="ws-disclosure"><summary>복사가 안 되나요? 지시문 직접 보기</summary><textarea className="ws-input" value={hostPrompt} readOnly rows={6} aria-label="직접 복사할 작성 지시문" /></details><label className="ws-label" htmlFor="pasted-result">작성 결과 붙여넣기</label><textarea id="pasted-result" className="ws-input" rows={6} value={pasted} onChange={e => setPasted(e.target.value)} placeholder={"제목: …\n본문:\n…"} /><div className="ws-secondary-actions"><button className="ws-button" type="button" onClick={() => void paste()}>클립보드에서 가져오기</button><button className="ws-button ws-button-primary" type="button" onClick={() => applyPasted()}>입력한 글 적용<UiIcon name="arrow" size={16} /></button></div></div>}
      </section>}
      {step === 2 && <>
        <section className="ws-panel ws-compose"><h2>우리 매장답게 다듬어 주세요.</h2><p className="ws-helper">수정한 초안이 다음 단계 이미지에 반영돼요.</p><div className="ws-form-group"><div className="ws-form-heading"><label className="ws-label" htmlFor="post-title">소식 제목</label><span>{title.length}자</span></div><input id="post-title" className="ws-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="고객의 관심을 끄는 제목" /></div><div className="ws-form-group"><div className="ws-form-heading"><label className="ws-label" htmlFor="post-body">소식 본문</label><span>{body.length.toLocaleString()}자</span></div><textarea id="post-body" className="ws-input" rows={12} value={body} onChange={e => setBody(e.target.value)} placeholder="고객에게 전하고 싶은 이야기를 적어 주세요." /></div>
          <div className="ws-form-group"><label htmlFor="post-tags" className="ws-label">해시태그</label><input id="post-tags" className="ws-input" value={tags.join(" ")} onChange={e => setTags(e.target.value.split(" "))} onBlur={() => setTags(previous => Array.from(new Set(previous.filter(Boolean).map(t => t.startsWith("#") ? t : `#${t}`))))} placeholder="#금박사 #제주금매입" /></div>
          {similarity >= 55 && <div className="ws-note ws-form-group"><UiIcon name="info" size={17} />최근 글과 문장이 비슷해요. 반복되는 표현을 확인해 주세요.</div>}
          <details className="ws-disclosure"><summary>문장 다듬기 · 다른 제목 제안</summary><div className="ws-chips">{EDIT_ACTIONS.map(a => <button className="ws-chip" type="button" key={a.id} disabled={!body.trim()} onClick={() => edit(a.id)}>{a.label}</button>)}</div>{altTitles.map(t => <button type="button" key={t} className="ws-button ws-button-wide ws-form-group" onClick={() => { setTitle(t); setAltTitles([]); }}>{t}</button>)}</details><div className="ws-editor-actions"><button className="ws-button" type="button" onClick={() => save("초안")}><UiIcon name="library" size={16} />초안 저장</button><button className="ws-button" type="button" disabled={!body.trim()} onClick={() => void copy(exportText())}><UiIcon name="copy" size={16} />글 복사</button></div></section>
        <button type="button" className="ws-button ws-button-primary ws-button-wide" disabled={!ready} onClick={() => move(3)}>이 초안으로 이미지 준비하기<UiIcon name="arrow" /></button><button type="button" className="ws-text-link ws-button-wide" disabled={!ready} onClick={() => move(4)}>이미지 없이 발행 준비</button>
      </>}
      <div hidden={step !== 3} id="images"><ImageStudio title={title} body={body} hashtags={tags} draft={studio} onChange={setStudio} onEdit={() => move(2)} onBusyChange={setImageBusy} />
        <div className="ws-editor-actions ws-form-group"><button type="button" className="ws-button" disabled={imageBusy} onClick={() => save("초안")}>글·이미지 저장</button><button type="button" className="ws-button ws-button-primary" disabled={!ready || imageBusy} onClick={() => move(4)}>발행 준비<UiIcon name="arrow" size={16} /></button></div><p className="ws-helper ws-form-group">이미지 없이 넘어가도 괜찮아요. 저장해야 보관함에서 이어 쓸 수 있어요.</p></div>
      {step === 4 && <><section className="ws-panel ws-compose"><h2>발행 전에 한 번 확인해 주세요.</h2><p className="ws-helper">실제 당근 화면과 다를 수 있는 미리보기예요.</p><div className="ws-preview ws-form-group"><PhonePreview title={title} body={exportText().slice(title.length).trim()} bizName={brand.businessName} time="미리보기" imageCopy="" imageSub="" bg={brand.color} logo={brand.logoUrl} logoText={brand.logoText} aiImages={images} /></div><div className="ws-checklist"><label><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} /><span>시세·거래 사례·연락처를 확인했어요. 생성한 이미지를 실제 매장·고객 사진으로 오해하게 쓰지 않아요.</span></label></div><div className="ws-editor-actions"><button type="button" className="ws-button" onClick={() => move(2)}>글 수정</button><button type="button" className="ws-button" onClick={() => move(3)}>이미지 수정</button><button type="button" className="ws-button" disabled={!checked} onClick={() => save("검수 완료")}>검수 완료로 저장</button></div><button type="button" className="ws-button ws-button-primary ws-button-wide ws-form-group" disabled={!checked || payloadBusy} onClick={() => void openSend()}>당근 발행 준비<UiIcon name="external" size={17} /></button><p className="ws-helper ws-form-group">실제 발행은 당근에서 내용을 확인하고 등록해야 완료돼요.</p></section><section className="ws-panel"><label htmlFor="plan-date" className="ws-label">나중에 올릴 예정인가요?</label><p className="ws-helper">자동 발행이 아니라 캘린더에 예정일을 기록해요.</p><div className="ws-secondary-actions ws-form-group"><input className="ws-input" id="plan-date" type="date" value={planDate} min={todayStr()} onChange={e => setPlanDate(e.target.value)} /><button type="button" className="ws-button" disabled={!checked || !planDate || planDate < todayStr()} onClick={() => save("발행 예정")}>발행 예정일 저장</button></div></section></>}
      <details className="ws-disclosure ws-form-group"><summary>실행 로그{logs.length ? ` (${logs.length})` : ""}</summary><div className="ws-note" style={{ whiteSpace: "pre-wrap", maxHeight: 180, overflow: "auto" }}>{logs.length ? logs.join("\n") : "아직 기록이 없어요. 글을 만들거나 저장하면 여기에 남습니다."}</div><button type="button" className="ws-button ws-button-wide" disabled={!logs.length} onClick={() => void copy(logs.join("\n"), "로그를 복사했어요.")}>로그 복사</button></details>
    </main>
    <UiDialog open={sendOpen} title="당근 발행 준비" onClose={() => setSendOpen(false)}><div className="ws-note"><UiIcon name="info" size={18} />복사해도 글이 자동 발행되지는 않아요.</div><div><h3 className="ws-label">1. 글을 복사하세요</h3><button type="button" className="ws-button ws-button-wide" onClick={() => void copy(exportText(), "제목·본문·해시태그를 복사했어요.")}>글 전체 복사</button></div><div><h3 className="ws-label">2. 이미지를 준비하세요</h3><div className="ws-secondary-actions">{images.map((url, i) => <a key={i} href={url} download={`post-image-${i + 1}.jpg`} className="ws-button">이미지 {i + 1} 저장</a>)}</div></div><div><h3 className="ws-label">3. 당근에서 붙여넣고 등록하세요</h3><a href="https://www.daangn.com/kr/business" target="_blank" rel="noopener noreferrer" className="ws-button ws-button-primary ws-button-wide">당근 비즈니스 열기<UiIcon name="external" size={17} /></a><p className="ws-helper ws-form-group">이미지를 첨부하고 등록 전 최종 확인해 주세요.</p></div><details className="ws-disclosure"><summary>고급 · PC 확장 프로그램으로 전달</summary><p className="ws-helper">연결된 Chrome 확장 프로그램에서 ‘AI 글 채우기’를 누르세요. 실제 첨부·발행 여부는 직접 확인해야 해요.</p><button type="button" className="ws-button ws-button-wide ws-form-group" disabled={payloadBusy || !payload} onClick={() => { log("확장 프로그램용 데이터 복사"); void copy(payload, "확장 프로그램용 데이터를 복사했어요."); }}>{payloadBusy ? "이미지 데이터 준비 중…" : "확장 프로그램용 데이터 복사"}</button><p className="ws-helper">{images.length}장 포함</p></details></UiDialog>
    {toast && <div className="ws-toast" role="status">{toast}</div>}
  </div>;
}
export default function CreatePage() { return <Suspense fallback={<div className="ws-empty">작성 화면을 준비하고 있어요.</div>}><CreateInner /></Suspense>; }
