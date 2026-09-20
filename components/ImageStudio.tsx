"use client";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { openHostAi } from "@/lib/ai-host";
import { IMAGE_TYPES, IMAGE_MOODS, SLOT_NAMES, emptySlot, imagePrompt, chatImagePrompt, draftSignature, prepareImage, type ImageStudioDraft, type ImageSettings } from "@/lib/image-studio";
import styles from "./ImageStudio.module.css";

type Props = {
  title: string; body: string; hashtags: string[]; draft: ImageStudioDraft;
  onChange: Dispatch<SetStateAction<ImageStudioDraft>>;
  onEdit: () => void; onBusyChange: (value: boolean) => void;
};
export default function ImageStudio({ title, body, hashtags, draft, onChange, onEdit, onBusyChange }: Props) {
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [notice, setNotice] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const running = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const pendingChatImages = useRef("");
  const mounted = useRef(true);
  const { settings } = draft;
  const signature = draftSignature(title, body, draft);
  const slots = draft.slots.slice(0, 2);
  const count = slots.filter(s => s.url).length;
  const ready = !!title.trim() && !!body.trim();
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; controller.current?.abort(); };
  }, []);
  useEffect(() => {
    const receive = () => {
      const bridge = document.getElementById("cpai-image-bridge");
      const raw = bridge?.getAttribute("data-payload");
      if (!raw) return;
      try {
        const payload = JSON.parse(raw) as { requestId?: string; images?: { dataUrl?: string; slot?: number }[] };
        if (!payload.requestId || payload.requestId !== pendingChatImages.current || !Array.isArray(payload.images)) return;
        const received = payload.images
          .filter(item => typeof item.dataUrl === "string" && /^data:image\/(png|jpeg|webp);base64,/i.test(item.dataUrl))
          .slice(0, 2);
        if (!received.length) return;
        onChange(previous => {
          const slots = [...previous.slots];
          received.forEach((item, order) => {
            const index = Number.isInteger(item.slot) ? Math.min(1, Math.max(0, item.slot!)) : order;
            slots[index] = { url: item.dataUrl!, prompt: imagePrompt(title, body, previous, index), source: "ai", signature: draftSignature(title, body, previous) };
          });
          const highest = Math.max(...received.map((item, order) => Number.isInteger(item.slot) ? item.slot! : order));
          return { ...previous, settings: { ...previous.settings, count: Math.min(2, Math.max(previous.settings.count, highest + 1)) }, slots };
        });
        pendingChatImages.current = "";
        bridge?.setAttribute("data-consumed-id", payload.requestId);
        window.dispatchEvent(new Event("cpai:generated-images-consumed"));
        report(`ChatGPT 이미지 ${received.length}장을 갤러리에 자동으로 넣었어요.`);
      } catch { /* 확장프로그램 데이터가 완성될 때까지 기다린다. */ }
    };
    window.addEventListener("cpai:generated-images", receive);
    return () => window.removeEventListener("cpai:generated-images", receive);
  }, [body, onChange, title]);
  const report = (message: string) => {
    if (!mounted.current) return;
    setNotice(message); setLogs(previous => [...previous.slice(-19), `${new Date().toLocaleTimeString("ko-KR")} ${message}`]);
  };
  const lock = (value: boolean) => { running.current = value; if (mounted.current) { setBusy(value); onBusyChange(value); } };
  const updateSettings = (patch: Partial<ImageSettings>) => onChange(previous => ({ ...previous, settings: { ...previous.settings, ...patch } }));
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); report("프롬프트를 복사했어요."); }
    catch { report("복사가 차단됐어요. ‘프롬프트 보기’를 펼쳐 직접 복사해 주세요."); }
  };
  const upload = async (file: File | undefined, index?: number) => {
    if (!file || running.current) return;
    lock(true);
    try {
      const dataUrl = await prepareImage(file);
      if (!mounted.current) return;
      onChange(previous => index === undefined
        ? { ...previous, reference: { name: file.name, dataUrl } }
        : { ...previous, slots: previous.slots.map((slot, i) => i === index ? { url: dataUrl, prompt: "", source: "upload", signature: "" } : slot) });
      if (index !== undefined) setErrors(previous => ({ ...previous, [index]: "" }));
      report(index === undefined ? "참고 이미지를 첨부했어요. 생성 버튼을 누르기 전에는 외부로 보내지 않아요." : `${SLOT_NAMES[index]}를 불러왔어요.`);
    } catch (error) { report(error instanceof Error ? error.message : "파일을 읽지 못했어요."); }
    finally { lock(false); }
  };
  const changeCount = (value: number) => {
    if (value < settings.count && draft.slots.slice(value).some(s => s.url) && !window.confirm("장수를 줄이면 뒤쪽 이미지가 비워져요. 계속할까요?")) return;
    onChange(previous => ({ ...previous, settings: { ...previous.settings, count: value }, slots: previous.slots.map((slot, i) => i < value ? slot : emptySlot()) }));
  };
  const clear = (index?: number) => {
    if (!window.confirm(index === undefined ? "현재 갤러리의 이미지를 모두 비울까요?" : `${SLOT_NAMES[index]}를 비울까요?`)) return;
    onChange(previous => ({ ...previous, slots: previous.slots.map((slot, i) => index === undefined || index === i ? emptySlot() : slot) }));
    setErrors({}); report("이미지를 비웠어요.");
  };
  const generate = async (index?: number) => {
    if (running.current || !ready) return;
    if (index !== undefined && index >= settings.count) updateSettings({ count: index + 1 });
    const indices = index === undefined ? Array.from({ length: settings.count }, (_, i) => i) : [index];
    if (settings.method === "chatgpt" || settings.method === "gemini") {
      const host = settings.method;
      const hostName = host === "gemini" ? "Gemini" : "ChatGPT";
      const prompt = chatImagePrompt(title, body, draft, indices);
      const clipboard = navigator.clipboard?.writeText(prompt).then(() => true).catch(() => false) ?? Promise.resolve(false);
      // Never send a reference-based request before the user attaches the actual file.
      if (draft.reference) window.open(host === "gemini" ? "https://gemini.google.com/app" : "https://chatgpt.com/", "_blank", "noopener,noreferrer");
      else {
        const requestId = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
        pendingChatImages.current = requestId;
        openHostAi(host, prompt, { mode: "image", count: indices.length, slots: indices, requestId });
      }
      const copied = await clipboard;
      report(draft.reference
        ? `${hostName} 창에 참고 파일을 직접 첨부하고 ${copied ? "복사된" : "아래의"} 프롬프트를 붙여넣어 전송해 주세요. 완성한 이미지는 ‘파일 선택’으로 가져와요.`
        : `${hostName} 열기를 요청했어요. 완성된 이미지는 확장프로그램이 갤러리에 자동으로 넣어요. 자동 입력이 안 되면 ${copied ? "복사된 프롬프트를" : "프롬프트를 복사해"} 직접 붙여넣으세요.`);
      return;
    }
  };
  return <div className={styles.root}>
    <section className={styles.panel} aria-labelledby="draft-preview-title">
      <div className={styles.heading}><div><p className={styles.eyebrow}>이미지의 기준이 되는 글</p><h2 id="draft-preview-title">현재 초안</h2></div><button type="button" onClick={onEdit} disabled={busy} className={styles.secondary}>수정하기</button></div>
      <h3 className={styles.draftTitle}>{title || "아직 제목이 없어요"}</h3>
      <p className={styles.excerpt}>{body || "먼저 초안을 작성해 주세요. 작성한 내용에 맞춰 이미지 프롬프트가 만들어져요."}</p>
      {hashtags.length > 0 && <div className={styles.tags}>{hashtags.map((tag, i) => <span key={`${tag}-${i}`}>{tag}</span>)}</div>}
      <details className={styles.disclosure}><summary>본문 전체 보기</summary><p className={styles.fullBody}>{body}</p></details>
      {!ready && <button type="button" className={styles.primary} onClick={onEdit}>초안 작성하러 가기</button>}
    </section>
    <section className={styles.panel} aria-labelledby="image-settings-title">
      <p className={styles.eyebrow}>03 · 글에 어울리는 한 장</p><h2 id="image-settings-title">이미지 만들기</h2><p className={styles.helper}>대표 이미지부터 보조 이미지까지, 최신 초안을 기준으로 준비해요.</p>
      <fieldset disabled={busy} className={styles.fields}>
        <div className={styles.pair}><label>이미지 유형<select value={settings.type} onChange={e => updateSettings({ type: e.target.value })}>{IMAGE_TYPES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>이미지 분위기<select value={settings.mood} onChange={e => updateSettings({ mood: e.target.value })}>{IMAGE_MOODS.map(m => <option key={m}>{m}</option>)}</select></label></div>
        <label>AI 요청사항<textarea rows={3} maxLength={1500} value={settings.requirements} onChange={e => updateSettings({ requirements: e.target.value })} placeholder="예) 현대 웹툰 느낌, 밝은 주황색 포인트. 금반지를 살펴보는 손을 중심으로." /></label>
        <label>참고 이미지 <small>선택 · JPG, PNG, WEBP / 최대 10MB</small><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ""; void upload(file); }} /></label>
        {draft.reference && <><div className={styles.reference}><img src={draft.reference.dataUrl} alt="첨부한 참고 이미지" /><span>{draft.reference.name}</span><button type="button" className={styles.secondary} onClick={() => onChange(p => ({ ...p, reference: null }))}>제거</button></div><label>참고 이미지 반영 방식<textarea rows={3} maxLength={1000} value={settings.referencePrompt} onChange={e => updateSettings({ referencePrompt: e.target.value })} /></label><p className={styles.helper}>참고 파일은 현재 작업에서만 유지돼요. 저장한 글을 다시 열면 다시 첨부해 주세요.</p></>}
        <div className={styles.pair}><label>준비할 이미지<select value={settings.count} onChange={e => changeCount(Number(e.target.value))}>{[1, 2].map(n => <option key={n} value={n}>{n}장{n === 1 ? " · 기본" : " · 최대"}</option>)}</select></label><label>생성 방식<select value={settings.method} onChange={e => updateSettings({ method: e.target.value as ImageSettings["method"] })}><option value="chatgpt">ChatGPT 창에서 생성</option><option value="gemini">Gemini 창에서 생성</option></select></label></div>
      </fieldset>
      <p className={styles.note}>확장프로그램이 {settings.method === "gemini" ? "Gemini" : "ChatGPT"}에서 완성된 이미지를 이 갤러리에 자동으로 가져와요. 참고 이미지를 쓰는 경우에는 열린 AI 창에 직접 첨부해 주세요.</p>
      {notice && <p role="status" aria-live="polite" className={styles.feedback}>{notice}</p>}
      <button type="button" className={styles.primary} disabled={!ready || busy} onClick={() => void generate()}>{busy ? "이미지를 준비하고 있어요…" : `${settings.method === "gemini" ? "Gemini" : "ChatGPT"}에서 이미지 ${settings.count}장 만들기`}</button>
      {busy && active !== null && <button type="button" className={styles.secondary} onClick={() => controller.current?.abort()}>생성 중단</button>}
    </section>
    <section className={styles.panel} aria-labelledby="image-gallery-title">
      <div className={styles.heading}><div><p className={styles.eyebrow}>{count} / 2장 준비됨</p><h2 id="image-gallery-title">이미지 갤러리</h2></div><button type="button" disabled={busy || !count} onClick={() => clear()} className={styles.secondary}>모두 비우기</button></div>
      <p className={styles.helper}>두 칸을 항상 보여줘요. 1장을 선택하면 대표 이미지에만 결과가 들어갑니다.</p>
      <div className={styles.gallery}>{slots.map((slot, i) => <article key={i} className={styles.slot} aria-label={SLOT_NAMES[i]} aria-busy={active === i}>
        <div className={styles.image}>{slot.url ? <img src={slot.url} alt={SLOT_NAMES[i]} /> : <div className={styles.placeholder}><span aria-hidden="true">＋</span><p>아직 이미지가 없어요</p></div>}{active === i && <div className={styles.overlay}>생성 중…</div>}</div>
        <div className={styles.slotBody}><div className={styles.heading}><h3>{SLOT_NAMES[i]}</h3><span className={styles.badge}>{slot.url ? slot.source === "ai" ? "AI 생성" : "이미지 준비됨" : "미등록"}</span></div>
          {slot.source === "ai" && slot.signature && slot.signature !== signature && <p className={styles.warning}>글이나 설정이 바뀌었어요. 현재 이미지가 내용과 맞는지 확인해 주세요.</p>}
          {errors[i] && <p className={styles.warning} role="alert">{errors[i]}</p>}
          <details className={styles.disclosure}><summary>현재 초안 기준 프롬프트 보기</summary><textarea aria-label={`${SLOT_NAMES[i]} 프롬프트`} readOnly rows={5} value={imagePrompt(title, body, draft, i)} /></details>
          <div className={styles.actions}><button type="button" disabled={busy || !ready} onClick={() => void generate(i)}>{slot.url ? "다시 생성" : "개별 생성"}</button><label className={busy ? styles.disabled : ""}>파일 선택<input type="file" disabled={busy} accept="image/jpeg,image/png,image/webp" aria-label={`${SLOT_NAMES[i]} 파일 선택`} onChange={e => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ""; void upload(file, i); }} /></label><button type="button" onClick={() => void copy(imagePrompt(title, body, draft, i))}>프롬프트 복사</button><button type="button" disabled={busy || !slot.url} onClick={() => clear(i)}>비우기</button></div>
          {slot.url && <a className={styles.download} href={slot.url} download={`post-image-${i + 1}.jpg`}>이미지 저장 ↓</a>}
        </div>
      </article>)}</div>
      <details className={styles.disclosure}><summary>고급 · 실행 기록</summary><p className={styles.helper}>현재 화면의 작업 기록이에요. 이미지 원본·API 키는 기록하지 않아요.</p><pre>{logs.join("\n") || "아직 실행 기록이 없어요."}</pre><button type="button" className={styles.secondary} onClick={() => void copy(logs.join("\n"))}>기록 복사</button></details>
    </section>
  </div>;
}
