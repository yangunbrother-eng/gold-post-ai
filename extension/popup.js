const $ = (id) => document.getElementById(id);
const SITE_URL = "http://localhost:3000/create";

function render(payload) {
  const connected = !!(payload && payload.title && payload.body);
  $("conn").className = connected ? "on" : "off";
  $("conn").textContent = connected
    ? "● 연결됨 (" + String(payload.title).slice(0, 18) + "…)"
    : "○ 미연결 — 아래 연결 버튼을 눌러주세요";
  $("connectView").classList.toggle("hidden", connected);
  $("readyView").classList.toggle("hidden", !connected);
  if (connected) {
    $("titlePreview").textContent = "제목: " + payload.title;
  }
}

chrome.storage.local.get("cpai_payload", (r) => render(r.cpai_payload || null));

$("connect").onclick = () => {
  chrome.tabs.create({ url: SITE_URL });
  window.close();
};

$("save").onclick = () => {
  try {
    const p = JSON.parse($("payload").value);
    if (!p.title || !p.body) throw new Error("bad");
    const images = Array.isArray(p.images) ? p.images.slice(0, 2).map((im) => ({
      slot: im.slot,
      dataUrl: im.dataUrl || im.url || null,
      url: im.url || null,
    })) : [];
    const payload = { title: p.title, body: p.body, images };
    chrome.storage.local.set({ cpai_payload: payload }, () => render(payload));
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
