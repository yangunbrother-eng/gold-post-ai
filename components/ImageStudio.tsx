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
  const [server, setServer] = useState<boolean | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const running = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const { settings } = draft;
  const signature = draftSignature(title, body, draft);
  const slots = draft.slots.slice(0, settings.count);
  const count = slots.filter(s => s.url).length;
  const ready = !!title.trim() && !!body.trim();
  useEffect(() => {
    mounted.current = true;
    const request = new AbortController();
    fetch("/api/generate-image", { signal: request.signal, cache: "no-store" })
      .then(r => r.ok ? r.json() : Promise.reject()).then(j => { if (mounted.current) setServer(j.configured === true); })
      .catch(() => { if (mounted.current) setServer(false); });
    return () => { mounted.current = false; controller.current?.abort(); request.abort(); };
  }, []);
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
    const indices = index === undefined ? Array.from({ length: settings.count }, (_, i) => i) : [index];
    if (settings.method === "chatgpt") {
      const prompt = chatImagePrompt(title, body, draft, indices);
      const clipboard = navigator.clipboard?.writeText(prompt).then(() => true).catch(() => false) ?? Promise.resolve(false);
      // Never send a reference-based request before the user attaches the actual file.
      if (draft.reference) window.open("https://chatgpt.com/", "_blank", "noopener,noreferrer");
      else openHostAi("chatgpt", prompt);
      const copied = await clipboard;
      report(draft.reference
        ? `ChatGPT 창에 참고 파일을 직접 첨부하고 ${copied ? "복사된" : "아래의"} 프롬프트를 붙여넣어 전송해 주세요. 완성한 이미지는 ‘파일 선택’으로 가져와요.`
        : `ChatGPT 열기를 요청했어요. 확장프로그램이 없거나 자동 입력이 안 되면 ${copied ? "복사된 프롬프트를" : "프롬프트를 복사해"} 직접 붙여넣으세요. 완성한 이미지는 ‘파일 선택’으로 가져와요.`);
      return;
    }
    if (!server) { report("사이트 이미지 AI가 연결되지 않았어요. ChatGPT 방식이나 파일 선택을 사용해 주세요."); return; }
    if (indices.some(i => draft.slots[i].url) && !window.confirm("선택한 이미지가 새 생성 결과로 바뀝니다. 다시 생성할까요?")) return;
    lock(true); setErrors({});
    const abort = new AbortController(); controller.current = abort;
    let done = 0;
    try {
      for (const i of indices) {
        if (abort.signal.aborted) break;
        setActive(i); report(`${SLOT_NAMES[i]} 생성 중… (${done + 1}/${indices.length})`);
        const prompt = imagePrompt(title, body, draft, i);
        const timer = setTimeout(() => abort.abort(), 115000);
        try {
          const response = await fetch("/api/generate-image", {
            method: "POST", signal: abort.signal, headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt, count: 1, referenceImage: draft.reference?.dataUrl }),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.message || "이미지 생성에 실패했어요.");
          const url = result.images?.[0]?.url;
          if (typeof url !== "string" || !/^data:image\/(png|jpeg|webp);base64,/.test(url)) throw new Error("올바른 이미지 결과를 받지 못했어요.");
          const bytes = await (await fetch(url)).blob();
          const safeImage = await prepareImage(bytes);
          if (abort.signal.aborted || !mounted.current) break;
          onChange(previous => ({ ...previous, slots: previous.slots.map((slot, n) => n === i ? { url: safeImage, prompt, source: "ai", signature } : slot) }));
          done++;
        } catch (error) {
          if (abort.signal.aborted) break;
          const message = error instanceof Error ? error.message : "이미지 생성에 실패했어요.";
          setErrors(previous => ({ ...previous, [i]: message })); report(message);
          // Stop on failure. Do not repeatedly spend API quota on a failed batch.
          break;
        } finally { clearTimeout(timer); }
      }
      report(abort.signal.aborted ? `생성을 중단했어요. 완료된 ${done}장은 유지돼요.` : `${done}/${indices.length}장 완료. 생성한 이미지를 확인해 주세요.`);
    } finally { controller.current = null; if (mounted.current) setActive(null); lock(false); }
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
        <div className={styles.pair}><label>준비할 이미지<select value={settings.count} onChange={e => changeCount(Number(e.target.value))}>{[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}장{n === 2 ? " · 기본" : ""}</option>)}</select></label><label>생성 방식<select value={settings.method} onChange={e => updateSettings({ method: e.target.value as ImageSettings["method"] })}><option value="chatgpt">ChatGPT 창에서 생성</option><option value="server">사이트 AI로 자동 생성</option></select></label></div>
      </fieldset>
      <p className={styles.note}>{settings.method === "chatgpt" ? "ChatGPT에서 만든 이미지는 아래 ‘파일 선택’으로 가져와요. 참고 이미지가 있으면 ChatGPT 창에 직접 첨부한 뒤 전송해 주세요." : server === null ? "사이트 이미지 AI 연결을 확인하고 있어요." : server ? "서버 이미지 API로 생성해 갤러리에 넣어요. 참고 이미지를 첨부했다면 실제 파일도 함께 전송해요. API 사용료가 발생할 수 있어요." : "사이트 이미지 API 키가 아직 연결되지 않았어요. ChatGPT 생성·파일 업로드는 그대로 사용할 수 있어요."}</p>
      <button type="button" className={styles.primary} disabled={!ready || busy || (settings.method === "server" && server !== true)} onClick={() => void generate()}>{busy ? "이미지를 준비하고 있어요…" : settings.method === "server" ? `이미지 ${settings.count}장 한 번에 생성` : `ChatGPT에서 이미지 ${settings.count}장 만들기`}</button>
      {busy && active !== null && <button type="button" className={styles.secondary} onClick={() => controller.current?.abort()}>생성 중단</button>}
      {notice && <p role="status" aria-live="polite" className={styles.feedback}>{notice}</p>}
    </section>
    <section className={styles.panel} aria-labelledby="image-gallery-title">
      <div className={styles.heading}><div><p className={styles.eyebrow}>{count} / {settings.count}장 준비됨</p><h2 id="image-gallery-title">이미지 갤러리</h2></div><button type="button" disabled={busy || !count} onClick={() => clear()} className={styles.secondary}>모두 비우기</button></div>
      <p className={styles.helper}>당근 소식은 기본 1~2장으로 시작하고, 필요할 때 최대 4장까지 준비하세요.</p>
      <div className={styles.gallery}>{slots.map((slot, i) => <article key={i} className={styles.slot} aria-label={SLOT_NAMES[i]} aria-busy={active === i}>
        <div className={styles.image}>{slot.url ? <img src={slot.url} alt={SLOT_NAMES[i]} /> : <div className={styles.placeholder}><span aria-hidden="true">＋</span><p>아직 이미지가 없어요</p></div>}{active === i && <div className={styles.overlay}>생성 중…</div>}</div>
        <div className={styles.slotBody}><div className={styles.heading}><h3>{SLOT_NAMES[i]}</h3><span className={styles.badge}>{slot.url ? slot.source === "ai" ? "AI 생성" : "이미지 준비됨" : "미등록"}</span></div>
          {slot.source === "ai" && slot.signature && slot.signature !== signature && <p className={styles.warning}>글이나 설정이 바뀌었어요. 현재 이미지가 내용과 맞는지 확인해 주세요.</p>}
          {errors[i] && <p className={styles.warning} role="alert">{errors[i]}</p>}
          <details className={styles.disclosure}><summary>현재 초안 기준 프롬프트 보기</summary><textarea aria-label={`${SLOT_NAMES[i]} 프롬프트`} readOnly rows={5} value={imagePrompt(title, body, draft, i)} /></details>
          <div className={styles.actions}><button type="button" disabled={busy || !ready || (settings.method === "server" && server !== true)} onClick={() => void generate(i)}>{slot.url ? "다시 생성" : "개별 생성"}</button><label className={busy ? styles.disabled : ""}>파일 선택<input type="file" disabled={busy} accept="image/jpeg,image/png,image/webp" aria-label={`${SLOT_NAMES[i]} 파일 선택`} onChange={e => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ""; void upload(file, i); }} /></label><button type="button" onClick={() => void copy(imagePrompt(title, body, draft, i))}>프롬프트 복사</button><button type="button" disabled={busy || !slot.url} onClick={() => clear(i)}>비우기</button></div>
          {slot.url && <a className={styles.download} href={slot.url} download={`post-image-${i + 1}.jpg`}>이미지 저장 ↓</a>}
        </div>
      </article>)}</div>
      <details className={styles.disclosure}><summary>고급 · 실행 기록</summary><p className={styles.helper}>현재 화면의 작업 기록이에요. 이미지 원본·API 키는 기록하지 않아요.</p><pre>{logs.join("\n") || "아직 실행 기록이 없어요."}</pre><button type="button" className={styles.secondary} onClick={() => void copy(logs.join("\n"))}>기록 복사</button></details>
    </section>
  </div>;
}
