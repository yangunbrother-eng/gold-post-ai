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

  const cleanBody = (text) => String(text || "")
    .replace(/\r\n?/g, "\n")
    .replace(/\s*첫 문장을 더 강하게 다듬어 주세요\s*/g, "")
    .replace(/\s*당근 독자에게 더 짧게 정리해 주세요\s*/g, "")
    .replace(/금박사 제주점\s*주소:/g, "금박사 제주점\n주소:")
    .replace(/\)\s*영업시간:/g, ")\n영업시간:")
    .replace(/\)\s*전화:/g, ")\n전화:")
    .replace(/\s*(#[^\n]+)$/g, "\n\n$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const fill = (el, text) => {
    el.focus();
    if ("value" in el) {
      el.value = "";
      document.execCommand("selectAll", false, null);
      document.execCommand("insertText", false, text);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      selection.removeAllRanges();
      selection.addRange(range);
      // 빈 문단도 함께 붙여넣어 본문 문단 사이의 여백을 유지한다.
      const editorText = cleanBody(text);
      const clipboardData = new DataTransfer();
      clipboardData.setData("text/plain", editorText);
      const paste = new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true });
      // Let the editor create its own paragraph nodes instead of flattening newlines.
      el.dispatchEvent(paste);
      if (!paste.defaultPrevented) {
        editorText.split("\n").forEach((line, index) => {
          if (index) document.execCommand("insertParagraph", false, null);
          document.execCommand("insertText", false, line);
        });
      }
    }
  };

  const urlToFile = async (src, name) => {
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      return new File([blob], name, { type: blob.type || "image/jpeg" });
    } catch { return null; }
  };

  const fileToDataUrl = (file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });

  const setFiles = (input, files) => {
    try {
      const dt = new DataTransfer();
      files.forEach(file => dt.items.add(file));
      input.files = dt.files;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    } catch { return false; }
  };

  const attachThroughDaangnPicker = async (files) => {
    const serialized = [];
    for (const file of files) {
      const dataUrl = await fileToDataUrl(file);
      if (dataUrl) serialized.push({ dataUrl, name: file.name, type: file.type });
    }
    if (!serialized.length) return false;
    return new Promise((resolve) => {
      let settled = false;
      const done = (event) => {
        if (settled) return;
        settled = true;
        document.removeEventListener("cpai-daangn-upload-result", done);
        resolve(event.detail?.ok === true);
      };
      document.addEventListener("cpai-daangn-upload-result", done, { once: true });
      document.dispatchEvent(new CustomEvent("cpai-daangn-upload", { detail: { files: serialized } }));
      setTimeout(() => {
        if (settled) return;
        settled = true;
        document.removeEventListener("cpai-daangn-upload-result", done);
        resolve(false);
      }, 4500);
    });
  };

  const attachImages = async (images) => {
    if (!images || !images.length) return "none";
    const files = [];
    for (let i = 0; i < Math.min(images.length, 2); i++) {
      // 소식 만들기에서 온 AI 이미지: dataUrl 우선, 없으면 url fetch
      const src = images[i].dataUrl || images[i].url;
      if (!src) continue;
      const f = await urlToFile(src, `carrot-ai-${i + 1}.jpg`);
      if (f) files.push(f);
    }
    if (!files.length) return "fail";
    const inputs = [...document.querySelectorAll("input[type='file']")];
    if (inputs.length && setFiles(inputs[0], files)) return "ok";
    if (location.hostname === "bizprofile.daangn.com") {
      return await attachThroughDaangnPicker(files) ? "ok" : "fail";
    }
    return "nofield";
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

  let filling = false;
  const runAutofill = () => {
    if (filling) return;
    filling = true;
    chrome.storage.local.get("cpai_payload", async (r) => {
      try {
        let p = r.cpai_payload;
        if (!p) {
          toast("클립보드에서 찾는 중…");
          p = await readClipboardPayload();
          if (p) chrome.storage.local.set({ cpai_payload: p });
        }
        if (!p) { toast("먼저 사이트에서 당근 발행 준비를 눌러주세요"); return; }
        const titleEl =
          document.querySelector("#title-input") ||
          document.querySelector("input[placeholder*='제목']") ||
          [...document.querySelectorAll("input[type='text']")].find(visible);
        const areas = [...document.querySelectorAll("textarea")].filter(visible)
          .sort((a, b) => b.clientHeight - a.clientHeight);
        const bodyEl = areas[0] ||
          [...document.querySelectorAll("[contenteditable='true']")].filter(visible)
            .sort((a, b) => b.clientHeight - a.clientHeight)[0];
        let n = 0;
        if (titleEl) { fill(titleEl, p.title); n++; }
        if (bodyEl) { fill(bodyEl, cleanBody(p.body)); n++; }
        toast("입력 중…");
        const img = await attachImages(p.images);
        if (n === 2 && img === "ok") toast("✓ 제목·본문·이미지 입력됨! 확인 후 등록만 누르세요");
        else if (n === 2 && img === "none") toast("✓ 제목·본문 입력됨! 확인 후 등록하세요");
        else if (img === "nofield") toast("글 입력됨 · 이미지는 사진 버튼으로 직접 첨부하세요");
        else if (n === 2) toast("✓ 제목·본문 입력됨 · 이미지 첨부는 사진 버튼에서 확인해 주세요");
        else toast("일부만 입력됨 — 복사 버튼으로 직접 붙여넣으세요");
      } finally { filling = false; }
    });
  };
  btn.onclick = runAutofill;

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== "cpai-autofill") return;
    setTimeout(runAutofill, 350);
  });

  chrome.storage.local.get("cpai_autofill_requested_at", (result) => {
    const requestedAt = Number(result.cpai_autofill_requested_at || 0);
    if (!requestedAt || Date.now() - requestedAt > 2 * 60 * 1000) return;
    chrome.storage.local.remove("cpai_autofill_requested_at");
    setTimeout(runAutofill, 900);
  });
})();
