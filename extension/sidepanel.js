const $ = (id) => document.getElementById(id);
const SITE_URL = "http://localhost:3000/create";

function render(payload) {
  const connected = !!(payload && payload.title && payload.body);
  $("conn").className = connected ? "on" : "off";
  $("conn").textContent = connected
    ? "● 연결됨 (" + String(payload.title).slice(0, 20) + "…) — 아래 사용 순서대로 진행하세요."
    : "연결할 화면을 확인해 주세요. 아래에서 사용할 사이트를 선택하면 연결 방법과 사용 순서를 볼 수 있습니다.";
  $("connectView").classList.toggle("hidden", connected);
  $("readyView").classList.toggle("hidden", !connected);
  if (connected) {
    const n = Array.isArray(payload.images) ? payload.images.filter((im) => im.dataUrl || im.url).length : 0;
    $("titlePreview").textContent = "제목: " + payload.title + (n ? ` (이미지 ${n}장 포함)` : "");
  }
}

function savePayload(p) {
  const images = Array.isArray(p.images) ? p.images.slice(0, 2).map((im) => ({
    slot: im.slot,
    dataUrl: im.dataUrl || im.url || null,
    url: im.url || null,
  })) : [];
  const payload = { title: p.title, body: p.body, images };
  chrome.storage.local.set({ cpai_payload: payload }, () => render(payload));
}

chrome.storage.local.get("cpai_payload", (r) => render(r.cpai_payload || null));
// 사이트에서 저장되면 패널도 즉시 갱신
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.cpai_payload) render(changes.cpai_payload.newValue || null);
});

$("openSite").onclick = () => {
  chrome.tabs.create({ url: SITE_URL });
};

$("fromClipboard").onclick = async () => {
  try {
    const text = await navigator.clipboard.readText();
    const p = JSON.parse(text);
    if (!p.title || !p.body) throw new Error("bad");
    savePayload(p);
  } catch {
    $("conn").className = "off";
    $("conn").textContent = "○ 클립보드에 Payload이 없습니다. 사이트에서 당근에 보내기를 먼저 눌러주세요.";
  }
};

$("save").onclick = () => {
  try {
    const p = JSON.parse($("payload").value);
    if (!p.title || !p.body) throw new Error("bad");
    savePayload(p);
  } catch {
    $("conn").className = "off";
    $("conn").textContent = "○ JSON 형식이 아닙니다. 사이트에서 Payload 복사를 눌러 붙여넣으세요.";
  }
};

$("copyTitle").onclick = () => {
  chrome.storage.local.get("cpai_payload", (r) => {
    if (r.cpai_payload?.title) navigator.clipboard.writeText(r.cpai_payload.title);
  });
};
$("copyBody").onclick = () => {
  chrome.storage.local.get("cpai_payload", (r) => {
    if (r.cpai_payload?.body) navigator.clipboard.writeText(r.cpai_payload.body);
  });
};
$("copyBoth").onclick = () => {
  chrome.storage.local.get("cpai_payload", (r) => {
    const p = r.cpai_payload;
    if (p?.title || p?.body) navigator.clipboard.writeText((p.title || "") + "\n\n" + (p.body || ""));
  });
};
$("disconnect").onclick = () => {
  chrome.storage.local.remove("cpai_payload", () => render(null));
};
