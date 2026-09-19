"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Topbar from "@/components/Topbar";
import Icon from "@/components/Icon";
import { useBrand } from "@/lib/store";
import { openHostAi } from "@/lib/ai-host";
import {
  ADS_MCP_URL, ADS_GUIDE_URL, CHATGPT_GUIDE_URL, CSV_HEADER, MAX_REPORT_BYTES,
  accountKey, campaignKey, buildAdsPrompt, changePercent, dailyMetrics, decimal,
  demoReport, groupCreatives, money, observations, parseAdReport, previousPeriod,
  reportJSON, reportText, selectRows, seoulToday, shiftDay, summarize,
  type AdReport, type CreativeSummary,
} from "@/lib/ads-analysis";
import styles from "./AdsDashboard.module.css";

type SortKey = "spend" | "ctr" | "cpc" | "clicks" | "conversions";
const SORTS: { value: SortKey; label: string }[] = [
  { value: "spend", label: "광고비 높은 순" }, { value: "ctr", label: "클릭률 높은 순" },
  { value: "cpc", label: "클릭당 비용 낮은 순" }, { value: "clicks", label: "클릭 많은 순" },
  { value: "conversions", label: "전환 많은 순" },
];
const TAX = { included: "부가세 포함", excluded: "부가세 별도", unknown: "부가세 기준 미확인" };
function download(text: string, filename: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement("a"); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function shortTime(value: string) {
  return new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function Measure({ label, value, unit, note, change, comparable }: { label: string; value: string; unit: string; note: string; change: number | null; comparable: boolean }) {
  return <div className={styles.measure}><span>{label}</span><strong>{value}<small>{value !== "—" ? unit : ""}</small></strong><p>{note}</p><small className={styles.compare}>{comparable && change !== null ? `직전 동기간 대비 ${change > 0 ? "+" : ""}${decimal(change)}%` : "직전 동기간 비교 자료 부족"}</small></div>;
}
export default function AdsDashboard() {
  const { brand, activeBranchId } = useBrand();
  const today = seoulToday();
  const [from, setFrom] = useState(() => shiftDay(today, -7));
  const [to, setTo] = useState(() => shiftDay(today, -1));
  const [accountHint, setAccountHint] = useState("");
  const [mode, setMode] = useState<"mcp" | "file" | "paste">("mcp");
  const [raw, setRaw] = useState("");
  const [pending, setPending] = useState<AdReport | null>(null);
  const [report, setReport] = useState<AdReport | null>(null);
  const [account, setAccount] = useState("");
  const [campaign, setCampaign] = useState("");
  const [sort, setSort] = useState<SortKey>("spend");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [promptShown, setPromptShown] = useState(false);
  const [listLimit, setListLimit] = useState(10);
  const fileRef = useRef<HTMLInputElement>(null);
  const reportRef = useRef<HTMLElement>(null);
  const importRef = useRef<HTMLElement>(null);
  const generation = useRef(0);
  const mounted = useRef(true);
  const key = `cpai:ads:v1:${activeBranchId}`;
  const period = useMemo(() => { try { return previousPeriod(from, to); } catch { return null; } }, [from, to]);
  const prompt = useMemo(() => period ? buildAdsPrompt(accountHint || brand.businessName || "계정을 사용자에게 확인", from, to) : "", [period, accountHint, brand.businessName, from, to]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current++; }; }, []);
  useEffect(() => {
    generation.current++; setReport(null); setPending(null); setRaw(""); setAccount(""); setCampaign(""); setError(""); setMessage(""); setBusy(false); setAccountHint("");
    try { setHasSaved(!!localStorage.getItem(key)); } catch { setHasSaved(false); }
  }, [key]);
  useEffect(() => { setListLimit(10); }, [report, from, to, account, campaign, sort, query]);
  const rows = report?.rows || [];
  const selected = useMemo(() => period ? selectRows(rows, from, to, account, campaign) : [], [rows, from, to, account, campaign, period]);
  const previous = useMemo(() => period ? selectRows(rows, period.from, period.to, account, campaign) : [], [rows, period, account, campaign]);
  const metrics = useMemo(() => summarize(selected), [selected]);
  const previousMetrics = useMemo(() => summarize(previous), [previous]);
  const comparable = report?.complete !== false && !!period && new Set(selected.map(r => r.date)).size === period.days && new Set(previous.map(r => r.date)).size === period.days;
  const accounts = useMemo(() => Array.from(new Map(rows.map(r => [accountKey(r), r.account])).entries()), [rows]);
  const campaigns = useMemo(() => Array.from(new Map(rows.filter(r => !account || accountKey(r) === account).map(r => [campaignKey(r), `${r.campaign} · ${r.account}`])).entries()), [rows, account]);
  const creatives = useMemo(() => groupCreatives(selected).filter(r => `${r.name} ${r.campaign}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => {
    const av = a[sort], bv = b[sort];
    if (av === null) return bv === null ? a.name.localeCompare(b.name) : 1;
    if (bv === null) return -1;
    return (sort === "cpc" ? av - bv : bv - av) || a.name.localeCompare(b.name);
  }), [selected, query, sort]);
  const daily = useMemo(() => dailyMetrics(selected), [selected]);
  const notes = useMemo(() => observations(selected), [selected]);
  const maxSpend = Math.max(1, ...daily.map(d => d.spend));
  const available = !!report && !report.demo;
  const busyGuard = () => { if (busy) return true; setError(""); setMessage(""); return false; };
  const copy = async (text: string, feedback = "복사했어요.") => { try { await navigator.clipboard.writeText(text); if (mounted.current) setMessage(feedback); } catch { if (mounted.current) { setError("클립보드 권한이 없어요. 표시된 내용을 직접 선택해 복사해 주세요."); setPromptShown(true); } } };
  const preview = (text: string, source: string) => {
    try { const value = parseAdReport(text, source); setPending(value); setError(""); setMessage(`${value.rows.length}행을 읽었어요. 계정과 기간을 확인한 뒤 적용하세요.`); }
    catch (e) { setPending(null); setError(e instanceof Error ? e.message : "데이터를 읽지 못했어요."); }
  };
  const accept = (value: AdReport) => {
    setReport(value); setPending(null); setRaw(""); setAccount(""); setCampaign(""); setQuery(""); setError("");
    const min = value.rows[0].date, max = value.rows[value.rows.length - 1].date;
    if (!selectRows(value.rows, from, to).length) { setTo(max); setFrom(shiftDay(max, -6) < min ? min : shiftDay(max, -6)); }
    setMessage(value.demo ? "기능 확인용 예시를 보고 있어요. 실제 계정 데이터가 아니에요." : `${value.rows.length}행을 분석에 적용했어요. 자동 저장은 하지 않아요.`);
    requestAnimationFrame(() => reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const readFile = async (file?: File) => {
    if (!file || busyGuard()) return;
    if (file.size > MAX_REPORT_BYTES) { setError("최대 2MB 파일만 가져올 수 있어요."); return; }
    if (!/\.(csv|tsv|json|txt)$/i.test(file.name)) { setError("CSV·TSV·JSON 파일을 선택해 주세요. 엑셀은 CSV로 저장한 뒤 가져오세요."); return; }
    setBusy(true); const ticket = generation.current;
    try {
      const bytes = await file.arrayBuffer(); let text: string;
      try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { text = new TextDecoder("euc-kr", { fatal: true }).decode(bytes); }
      if (mounted.current && ticket === generation.current) preview(text, `파일 가져오기: ${file.name.slice(0, 120)}`);
    } catch { if (mounted.current && ticket === generation.current) setError("파일 인코딩을 읽지 못했어요. UTF-8 CSV로 저장해 주세요."); }
    finally { if (mounted.current && ticket === generation.current) setBusy(false); }
  };
  const launch = () => {
    if (!prompt || busyGuard()) return;
    // A deliberate click sends only the visible account hint and date request. No report data is auto-sent.
    setPromptShown(true);
    const copied = navigator.clipboard?.writeText(prompt).then(() => true).catch(() => false) ?? Promise.resolve(false);
    openHostAi("chatgpt", prompt);
    void copied.then(ok => { if (mounted.current) setMessage(`ChatGPT 열기를 요청했어요. MCP 인증과 조회는 그 창에서 진행해 주세요.${ok ? " 지시문도 복사했어요." : " 전송이 안 되면 아래 지시문을 직접 복사해 주세요."}`); });
  };
  const save = () => {
    if (!available || !report) return;
    try { localStorage.setItem(key, reportJSON(report)); setHasSaved(true); setMessage("이 브라우저의 현재 지점에 저장했어요. 공용 PC에서는 저장 데이터를 삭제해 주세요."); }
    catch { setError("브라우저에 저장하지 못했어요. JSON 내보내기로 보관해 주세요."); }
  };
  const restore = () => {
    try { const text = localStorage.getItem(key); if (!text) throw new Error("저장된 보고서가 없어요."); setPending(parseAdReport(text, "브라우저 저장 보고서")); setMessage("저장된 데이터를 읽었어요. 아래에서 확인 후 적용하세요."); importRef.current?.scrollIntoView({ behavior: "smooth" }); }
    catch (e) { setError(e instanceof Error ? e.message : "저장 데이터를 읽지 못했어요."); }
  };
  const clear = () => {
    if (!window.confirm("현재 화면의 보고서와 이 브라우저에 저장한 현재 지점의 광고 데이터를 삭제할까요? 당근 원본 광고에는 영향이 없어요.")) return;
    setReport(null); setPending(null); setRaw("");
    try { localStorage.removeItem(key); setHasSaved(false); setMessage("이 브라우저의 광고 데이터를 삭제했어요."); } catch { setError("화면은 비웠지만 저장 데이터 삭제는 실패했어요. 브라우저 저장 설정을 확인해 주세요."); }
  };
  const percentChange = (k: "spend" | "impressions" | "clicks" | "ctr" | "cpc" | "cpa") => changePercent(metrics[k], previousMetrics[k]);
  const fmt = (v: number | null, suffix: string, digits = false) => v === null ? "—" : `${digits ? decimal(v) : money(v)}${suffix}`;
  const latest = report?.rows[report.rows.length - 1].date;
  const creativeTopic = (row: CreativeSummary) => `광고 소재 ‘${row.name}’을 참고해 새로운 당근 소식을 작성해 주세요. 원문을 베끼지 말고 사실을 확인해 주세요. 수익이나 광고 성과를 보장하는 표현은 쓰지 마세요.`;

  return <div className="app-root"><Topbar title="" />
    <main className={styles.main} id="main-content" tabIndex={-1}>
      <header className={styles.intro}><p className={styles.eyebrow}>우리 가게 · 광고 작업실</p><div className={styles.heading}><h1>쓴 광고비, 어떤 반응이었을까요?</h1><span className={styles.readonly}><Icon name="check" size={14} />읽기 전용</span></div><p>광고비부터 클릭, 전환까지. 데이터를 가져오면 한눈에 정리해요.</p></header>
      <section className={styles.hero} aria-labelledby="ads-connect-title">
        <div className={styles.heading}><span className={styles.brand}><Icon name="carrot" size={23} />당근 광고 MCP</span><span className={styles.status}>ChatGPT에서 인증</span></div>
        <h2 id="ads-connect-title">광고 계정은 안전하게,<br />성과는 쉽게 살펴보세요.</h2>
        <p>ChatGPT에 연결한 당근 광고 MCP로 조회하고,<br />조회 결과를 아래로 가져와 분석하는 방식이에요.</p>
        <div className={styles.flow}><span>01 계정 인증</span><Icon name="chevron" size={13} /><span>02 성과 조회</span><Icon name="chevron" size={13} /><span>03 여기서 비교</span></div>
        <details className={styles.guide}><summary>MCP 연결 방법 · 처음 한 번만</summary><div>
          <p>당근 공식 안내의 전문가모드 광고 MCP를 ChatGPT의 앱/커넥터에 추가하고, 본인의 당근비즈니스 계정으로 승인해 주세요. 지원 요금제와 워크스페이스 권한은 공식 가이드에서 확인해 주세요.</p>
          <label htmlFor="ads-mcp-url">공식 MCP 서버 주소</label><input id="ads-mcp-url" readOnly value={ADS_MCP_URL} onFocus={e => e.currentTarget.select()} /><button type="button" className={styles.secondary} onClick={() => void copy(ADS_MCP_URL, "공식 당근 광고 MCP 주소를 복사했어요.")}><Icon name="copy" size={16} />주소 복사</button>
          <div className={styles.links}><a href={ADS_GUIDE_URL} target="_blank" rel="noopener noreferrer">당근 공식 연결 안내 ↗</a><a href={CHATGPT_GUIDE_URL} target="_blank" rel="noopener noreferrer">ChatGPT 앱 연결 안내 ↗</a></div>
          <p>사이트는 계정 인증 여부를 직접 확인하지 않아요. 비밀번호·인증 코드·API 키는 여기에 입력하지 마세요. 모바일에서 MCP 연결이 지원되지 않으면 PC에서 조회한 결과나 CSV를 가져오세요.</p>
        </div></details>
      </section>
      <section className={styles.panel} aria-labelledby="ads-period-title"><div className={styles.heading}><h2 id="ads-period-title">어느 기간을 볼까요?</h2><span className={styles.muted}>한국 시간 · 원화</span></div>
        <div className={styles.chips}>{[7, 14, 30].map(n => <button type="button" key={n} className={styles.chip} aria-pressed={from === shiftDay(today, -n) && to === shiftDay(today, -1)} onClick={() => { setFrom(shiftDay(today, -n)); setTo(shiftDay(today, -1)); }}>최근 {n}일</button>)}{report && <button type="button" className={styles.chip} onClick={() => { setFrom(report.rows[0].date); setTo(report.rows[report.rows.length - 1].date); }}>가져온 전체 기간</button>}</div>
        <div className={styles.pair}><label>시작일<input type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} /></label><label>종료일<input type="date" value={to} min={from || undefined} max={today} onChange={e => setTo(e.target.value)} /></label></div>
        {!period ? <p className={styles.error} role="alert">유효한 시작일·종료일을 선택해 주세요. 한 번에 최대 366일까지 볼 수 있어요.</p> : <p className={styles.muted}>비교 기간 {period.from} ~ {period.to} · 빠른 선택은 오늘을 제외해요.</p>}
      </section>
      <section ref={importRef} className={styles.panel} aria-labelledby="ads-import-title"><div className={styles.heading}><h2 id="ads-import-title">광고 데이터 가져오기</h2><span className={styles.status}>{report?.demo ? "예시 보는 중" : report ? "데이터 가져옴" : "데이터 없음"}</span></div>
        <div className={styles.tabs} role="group" aria-label="광고 데이터 가져오는 방법">{[{ id: "mcp", label: "MCP로 조회" }, { id: "file", label: "파일 가져오기" }, { id: "paste", label: "결과 붙여넣기" }].map(tab => <button type="button" key={tab.id} aria-pressed={mode === tab.id} onClick={() => setMode(tab.id as typeof mode)}>{tab.label}</button>)}</div>
        {mode === "mcp" && <div className={styles.stack}><label>조회할 광고 계정명 또는 ID<input value={accountHint} maxLength={300} onChange={e => setAccountHint(e.target.value)} placeholder={brand.businessName || "예) 금박사 제주점 광고 계정"} /></label><p className={styles.muted}>ChatGPT에 당근 광고 MCP를 먼저 연결해 주세요. 계정명과 선택한 기간만 조회 지시문에 포함돼요.</p><button type="button" className={styles.primary} disabled={!period || busy} onClick={launch}><Icon name="sparkles" size={19} />ChatGPT로 광고 조회 요청<Icon name="arrow" size={17} /></button><p className={styles.muted}>확장프로그램이 없거나 자동 전송이 안 되면 지시문을 붙여넣고 전송하세요. 조회 완료 후 JSON 코드 블록 전체를 아래 ‘결과 붙여넣기’로 가져오세요. 사이트에 자동 동기화되지는 않아요.</p><details open={promptShown} onToggle={e => setPromptShown(e.currentTarget.open)} className={styles.disclosure}><summary>조회 지시문 확인·복사</summary><textarea rows={6} readOnly value={prompt} aria-label="당근 광고 MCP 조회 지시문" /><button type="button" disabled={!prompt} className={styles.secondary} onClick={() => void copy(prompt)}>조회 지시문 복사</button></details><button type="button" className={styles.secondary} onClick={() => setMode("paste")}>조회한 결과 붙여넣기<Icon name="arrow" size={16} /></button></div>}
        {mode === "file" && <div className={styles.stack}><div className={styles.dropzone}><span className={styles.largeIcon}><Icon name="folder" size={28} /></span><h3>보고서 파일로 바로 분석</h3><p>CSV · TSV · JSON / 최대 2MB, 5,000행</p><input ref={fileRef} type="file" accept=".csv,.tsv,.json,.txt" aria-label="광고 보고서 파일 선택" disabled={busy} onChange={e => { const f = e.currentTarget.files?.[0]; e.currentTarget.value = ""; void readFile(f); }} /></div><p className={styles.muted}>당근에서 내려받은 파일에 날짜·소재명·광고비·노출수·클릭수가 있어야 해요. 일별·소재별 자료를 사용하고, 엑셀 파일은 CSV로 저장해 주세요.</p><button type="button" className={styles.secondary} onClick={() => download(`\uFEFF${CSV_HEADER}`, "광고분석_입력양식.csv", "text/csv")}>빈 CSV 양식 받기</button></div>}
        {mode === "paste" && <div className={styles.stack}><label htmlFor="ads-pasted">JSON 결과 또는 CSV·엑셀 표 붙여넣기</label><textarea id="ads-pasted" rows={8} maxLength={MAX_REPORT_BYTES} value={raw} onChange={e => { setRaw(e.target.value); setPending(null); }} placeholder={'날짜,광고계정,캠페인명,소재명,광고비,노출수,클릭수,전환수,전환매출\n(제목 행 아래에 실제 데이터를 넣어 주세요)'} /><div className={styles.actions}><button type="button" className={styles.secondary} disabled={busy} onClick={async () => { try { const t = await navigator.clipboard.readText(); if (new TextEncoder().encode(t).length > MAX_REPORT_BYTES) throw new Error("파일은 최대 2MB까지 가져올 수 있어요."); setRaw(t); setPending(null); setMessage("붙여넣은 내용을 확인한 뒤 데이터 검토를 눌러 주세요."); } catch { setError("클립보드를 읽을 수 없어요. 입력칸에 직접 붙여넣어 주세요."); } }}>클립보드에서 가져오기</button><button type="button" className={styles.primary} disabled={!raw.trim() || busy} onClick={() => preview(raw, "직접 붙여넣은 보고서")}>데이터 검토<Icon name="arrow" size={16} /></button></div></div>}
        {busy && <p role="status">보고서를 읽는 중이에요…</p>}
        {pending && <div className={styles.review} aria-label="가져올 보고서 검토"><h3>{pending.demo ? "예시 데이터" : "가져온 데이터 확인"}</h3><p>{pending.rows[0].date} ~ {pending.rows[pending.rows.length - 1].date} · {pending.rows.length}행</p><p>{Array.from(new Set(pending.rows.map(r => r.account))).join(" · ")}</p><p>광고비 {money(summarize(pending.rows).spend)}원 · {TAX[pending.taxBasis]}</p><p className={styles.muted}>적용하면 현재 화면의 보고서를 교체해요. 저장한 보고서는 덮어쓰지 않아요.</p>{pending.warnings.length > 0 && <details><summary>확인할 항목 {pending.warnings.length}개</summary>{pending.warnings.map(w => <p key={w}>{w}</p>)}</details>}<div className={styles.actions}><button type="button" className={styles.secondary} onClick={() => setPending(null)}>취소</button><button type="button" className={styles.primary} onClick={() => accept(pending)}>분석에 적용하기<Icon name="check" size={17} /></button></div></div>}
        {error && <p role="alert" className={styles.error}>{error}</p>}{message && <p role="status" className={styles.feedback}>{message}</p>}
        <p className={styles.privacy}><Icon name="info" size={16} />가져온 파일과 분석 수치는 서버로 보내지 않아요. 브라우저 저장은 직접 눌렀을 때만 실행돼요.</p>
        {hasSaved && <button type="button" className={styles.secondary} onClick={restore}>이 브라우저에 저장한 보고서 검토</button>}
      </section>
      <section className={styles.report} ref={reportRef} aria-labelledby="ads-report-title"><div className={styles.heading}><div><p className={styles.eyebrow}>PERFORMANCE REPORT</p><h2 id="ads-report-title">우리 광고 성과</h2></div><span className={styles.status}>{report?.demo ? "예시 데이터" : report ? "가져온 자료 기준" : "데이터 대기"}</span></div>
        {!report ? <div className={styles.empty}><span className={styles.largeIcon}><Icon name="trend" size={32} /></span><h3>광고 성과를 가져오면 여기에 보여요.</h3><p>광고비 · 노출 · 클릭률 · 클릭당 비용<br />실제 자료 없이 숫자를 채우지 않아요.</p><button type="button" className={styles.secondary} onClick={() => { setPending(demoReport()); importRef.current?.scrollIntoView({ behavior: "smooth" }); }}>예시 데이터로 기능 둘러보기</button></div> : <>
          {report.demo && <div className={styles.demoBanner} role="status">예시 데이터입니다. 실제 금박사 또는 당근 계정의 성과가 아니에요.</div>}
          <div className={styles.panel}><div className={styles.pair}><label>광고 계정<select value={account} onChange={e => { setAccount(e.target.value); setCampaign(""); }}><option value="">전체 가져온 계정</option>{accounts.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label><label>캠페인<select value={campaign} onChange={e => setCampaign(e.target.value)}><option value="">전체 캠페인</option>{campaigns.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label></div><p className={styles.muted}>출처(입력값): {report.source}<br />최근 데이터 {latest} · 가져온 시각 {shortTime(report.importedAt)} · {TAX[report.taxBasis]}</p><p className={styles.muted}>전환 기준: {report.attribution}</p><details className={styles.disclosure}><summary>데이터 품질·분석 기준 확인</summary>{report.warnings.map(w => <p key={w}>{w}</p>)}<p>비교는 현재·직전 기간 모든 날짜에 행이 있을 때 표시돼요. 일부 소재 누락 여부나 원본과의 일치는 이 사이트가 검증하지 못해요. 누락 날짜는 0으로 채우지 않아요.</p><p>CTR=총 클릭÷총 노출×100, CPC=총 광고비÷총 클릭, CPA=총 광고비÷총 전환, ROAS=총 전환매출÷총 광고비×100. 전환수나 매출이 없으면 관련 지표는 ‘—’로 표시해요.</p></details></div>
          {!selected.length && <p className={styles.error} role="status">선택한 기간·계정에 데이터가 없어요. 위의 ‘가져온 전체 기간’ 또는 계정 필터를 확인해 주세요.</p>}
          <div className={styles.metrics}>
            <Measure label="쓴 광고비" value={selected.length ? money(metrics.spend) : "—"} unit="원" note="가져온 행의 합계" change={percentChange("spend")} comparable={comparable} />
            <Measure label="노출수" value={selected.length ? money(metrics.impressions) : "—"} unit="회" note="광고가 노출된 횟수" change={percentChange("impressions")} comparable={comparable} />
            <Measure label="클릭수" value={selected.length ? money(metrics.clicks) : "—"} unit="회" note="보고서에 기록된 클릭" change={percentChange("clicks")} comparable={comparable} />
            <Measure label="클릭률 · CTR" value={decimal(metrics.ctr)} unit="%" note="노출 중 클릭한 비율" change={percentChange("ctr")} comparable={comparable} />
            <Measure label="클릭당 비용 · CPC" value={money(metrics.cpc)} unit="원" note="클릭 한 번에 쓴 비용" change={percentChange("cpc")} comparable={comparable} />
            <Measure label="전환당 비용 · CPA" value={money(metrics.cpa)} unit="원" note={`전환 ${decimal(metrics.conversions)}건 · ROAS ${fmt(metrics.roas, "%", true)}`} change={percentChange("cpa")} comparable={comparable} />
          </div>
          <section className={styles.panel} aria-labelledby="ads-insights-title"><p className={styles.eyebrow}>먼저 확인할 내용</p><h2 id="ads-insights-title">수치가 알려주는 점</h2><p className={styles.muted}>AI 추측이 아닌 입력 수치의 규칙 기반 요약이에요.</p><div className={styles.insights}>{notes.map((note, i) => <p key={note}><span>{i + 1}</span>{note}</p>)}</div></section>
          <section className={styles.panel} aria-labelledby="ads-daily-title"><div className={styles.heading}><h2 id="ads-daily-title">일별 광고비 흐름</h2><span className={styles.muted}>{daily.length}일 자료</span></div><p className={styles.muted}>최근 최대 30개 보고일 표시 · 자료 없는 날짜는 생략해요.</p><div className={styles.daily}>{daily.slice(-30).map(d => <div key={d.date}><time dateTime={d.date}>{d.date.slice(5)}</time><div className={styles.track}><span style={{ width: `${d.spend / maxSpend * 100}%` }} /></div><strong>{money(d.spend)}원</strong></div>)}</div><details className={styles.disclosure}><summary>일별 수치 전체 보기</summary><div className={styles.tableWrap} tabIndex={0} role="region" aria-label="일별 광고 성과 표"><table><caption>가져온 데이터의 일별 합계</caption><thead><tr><th scope="col">날짜</th><th scope="col">광고비</th><th scope="col">노출</th><th scope="col">클릭</th><th scope="col">CTR</th><th scope="col">CPC</th></tr></thead><tbody>{daily.map(d => <tr key={d.date}><th scope="row">{d.date}</th><td>{money(d.spend)}</td><td>{money(d.impressions)}</td><td>{money(d.clicks)}</td><td>{fmt(d.ctr, "%", true)}</td><td>{fmt(d.cpc, "원")}</td></tr>)}</tbody></table></div></details></section>
          <section className={styles.panel} aria-labelledby="ads-creatives-title"><div className={styles.heading}><h2 id="ads-creatives-title">어떤 소재에 반응했을까요?</h2><span className={styles.muted}>{creatives.length}개</span></div><div className={styles.pair}><label>소재·캠페인 검색<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="소재명으로 찾기" /></label><label>정렬<select value={sort} onChange={e => setSort(e.target.value as SortKey)}>{SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label></div><p className={styles.muted}>기준과 목표가 다른 캠페인은 따로 비교하세요. 소재 이름을 눌러 상세 수치를 펼칠 수 있어요.</p><div className={styles.creatives}>{creatives.slice(0, listLimit).map((r, i) => <details key={r.key} className={styles.creative}><summary><span className={styles.rank}>{i + 1}</span><span className={styles.creativeTitle}><strong>{r.name}</strong><small>{r.campaign} · {r.account}</small></span><span className={styles.creativeMetric}>{fmt(r[sort], sort === "ctr" ? "%" : sort === "clicks" ? "회" : sort === "conversions" ? "건" : "원", sort === "ctr" || sort === "conversions")}<small>{sort === "ctr" ? "클릭률" : sort === "cpc" ? "클릭당 비용" : sort === "clicks" ? "클릭수" : sort === "conversions" ? "전환수" : "광고비"}</small></span></summary><div className={styles.creativeBody}><dl><div><dt>노출</dt><dd>{money(r.impressions)}회</dd></div><div><dt>클릭</dt><dd>{money(r.clicks)}회</dd></div><div><dt>클릭률</dt><dd>{fmt(r.ctr, "%", true)}</dd></div><div><dt>클릭당 비용</dt><dd>{fmt(r.cpc, "원")}</dd></div><div><dt>전환수</dt><dd>{fmt(r.conversions, "건", true)}</dd></div><div><dt>전환당 비용</dt><dd>{fmt(r.cpa, "원")}</dd></div><div><dt>ROAS</dt><dd>{fmt(r.roas, "%", true)}</dd></div></dl><Link href={`/create?topic=${encodeURIComponent(creativeTopic(r))}`} className={styles.secondary}>이 소재로 새 소식 만들기<Icon name="arrow" size={15} /></Link></div></details>)}</div>{!creatives.length && <p className={styles.muted}>해당 소재가 없어요.</p>}{creatives.length > listLimit && <button type="button" className={styles.secondary} onClick={() => setListLimit(n => n + 10)}>소재 10개 더 보기</button>}</section>
          <section className={styles.panel} aria-labelledby="ads-save-title"><h2 id="ads-save-title">분석 결과 보관하기</h2><div className={styles.actions}><button type="button" className={styles.primary} disabled={!available} onClick={save}>이 브라우저에 저장</button><button type="button" className={styles.secondary} onClick={() => void copy(reportText(report, selected, from, to), "분석 요약을 복사했어요. 카톡에 붙여넣어도 돼요.")}>분석 요약 복사</button><button type="button" className={styles.secondary} onClick={() => download(reportJSON(report), `${report.demo ? "예시_" : ""}당근광고_${from}_${to}.json`)}>전체 데이터 내보내기</button><button type="button" className={styles.danger} onClick={clear}>데이터 삭제</button></div><p className={styles.muted}>브라우저 저장은 현재 기기·지점에만 적용돼요. 다른 PC·모바일로 옮길 때는 내보낸 JSON을 가져오세요. 당근 광고 설정은 바뀌지 않아요.</p>{hasSaved && <span className={styles.status}>이 브라우저에 저장된 보고서 있음</span>}{message && <p className={styles.feedback}>{message}</p>}{error && <p className={styles.error}>{error}</p>}</section>
        </>}
      </section>
      <footer className={styles.footer}>우리 가게의 다음 소식, 데이터에서 시작해요.<span>당근 Post AI · 광고 분석</span></footer>
    </main>
  </div>;
}
