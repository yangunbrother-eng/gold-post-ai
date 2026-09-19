// 당근 페이지에 떠 있는 "AI 글 채우기" 버튼. 저장된 제목·본문을 입력칸에 자동 입력.
(function () {
  if (document.getElementById("cpai-fill-btn")) return;

  const btn = document.createElement("button");
  btn.id = "cpai-fill-btn";
  btn.textContent = "✦ AI 글 채우기";
  Object.assign(btn.style, {
    position: "fixed", right: "18px", bottom: "18px", zIndex: 999999,
    background: "#FF6F0F", color: "#fff", border: "0", borderRadius: "12px",
    padding: "13px 18px", fontSize: "14px", fontWeight: "bold",
    cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,0.25)"
  });
  document.body.appendChild(btn);

  const toast = (msg) => {
    const t = document.createElement("div");
    t.textContent = msg;
    Object.assign(t.style, {
      position: "fixed", left: "50%", bottom: "70px", transform: "translateX(-50%)",
      zIndex: 999999, background: "#111", color: "#fff", padding: "10px 18px",
      borderRadius: "99px", fontSize: "13px", fontWeight: "bold"
    });
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  };

  const visible = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
  };

  const fill = (el, text) => {
    el.focus();
    if ("value" in el) {
      el.value = "";
      document.execCommand("selectAll", false, null);
      document.execCommand("insertText", false, text);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      el.textContent = "";
      document.execCommand("selectAll", false, null);
      document.execCommand("insertText", false, text);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  };

  const urlToFile = async (src, name) => {
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      return new File([blob], name, { type: blob.type || "image/jpeg" });
    } catch { return null; }
  };

  const attachImages = async (images) => {
    if (!images || !images.length) return "none";
    const inputs = [...document.querySelectorAll("input[type='file']")].filter(visible);
    if (!inputs.length) return "nofield";
    let done = 0;
    for (let i = 0; i < Math.min(images.length, 2); i++) {
      // 소식 만들기에서 온 AI 이미지: dataUrl 우선, 없으면 url fetch
      const src = images[i].dataUrl || images[i].url;
      if (!src) continue;
      const f = await urlToFile(src, `carrot-ai-${i + 1}.jpg`);
      const target = inputs[Math.min(i, inputs.length - 1)];
      if (!f || !target) continue;
      try {
        const dt = new DataTransfer();
        dt.items.add(f);
        target.files = dt.files;
        target.dispatchEvent(new Event("change", { bubbles: true }));
        target.dispatchEvent(new Event("input", { bubbles: true }));
        done++;
      } catch { /* 다음 이미지 계속 */ }
    }
    return done > 0 ? "ok" : "fail";
  };

  // 저장된 payload 우선, 없으면 클립보드의 payload(JSON 복사 상태)도 바로 사용
  const readClipboardPayload = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (!t) return null;
      const p = JSON.parse(t);
      if (!p.title || !p.body) return null;
      return p;
    } catch { return null; }
  };

  btn.onclick = () => {
    chrome.storage.local.get("cpai_payload", async (r) => {
      let p = r.cpai_payload;
      if (!p) {
        toast("클립보드에서 찾는 중…");
        p = await readClipboardPayload();
        if (p) chrome.storage.local.set({ cpai_payload: p });
      }
      if (!p) { toast("먼저 사이트에서 당근에 보내기 → Payload 복사"); return; }
      const titleEl =
        document.querySelector("input[placeholder*='제목']") ||
        [...document.querySelectorAll("input[type='text']")].find(visible);
      const areas = [...document.querySelectorAll("textarea")].filter(visible)
        .sort((a, b) => b.clientHeight - a.clientHeight);
      const bodyEl = areas[0] ||
        [...document.querySelectorAll("[contenteditable='true']")].filter(visible)
          .sort((a, b) => b.clientHeight - a.clientHeight)[0];
      let n = 0;
      if (titleEl) { fill(titleEl, p.title); n++; }
      if (bodyEl) { fill(bodyEl, p.body); n++; }
      toast("입력 중…");
      const img = await attachImages(p.images);
      if (n === 2 && img === "ok") toast("✓ 제목·본문·이미지 입력됨! 확인 후 등록만 누르세요");
      else if (n === 2 && img === "none") toast("✓ 제목·본문 입력됨! 확인 후 등록하세요");
      else if (img === "nofield") toast("글 입력됨 · 이미지는 사진 버튼으로 직접 첨부하세요");
      else toast("일부만 입력됨 — 복사 버튼으로 직접 붙여넣으세요");
    });
  };
})();
