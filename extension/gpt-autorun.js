// 당근 Post AI에서 연 호스트 GPT/Gemini 탭(#cpai=1 또는 ?cpai=1)에서만 동작.
// 사이트가 클립보드에 복사해 두거나 ?q= 로 넘겨준 지시문을 읽어 입력창에 자동 입력하고 전송까지 실행합니다.
// 일반적인 GPT/Gemini 탭에는 절대 손대지 않습니다.
(function () {
  const hash = location.hash || "";
  const search = location.search || "";
  const isCpai = hash.includes("cpai=1") || search.includes("cpai=1") || sessionStorage.getItem("cpai_active") === "1";
  
  if (!isCpai) return;
  if (sessionStorage.getItem("cpai_sent")) return;

  // SPA 라우터가 URL 해시나 쿼리를 지워도 유지되도록 세션에 저장
  sessionStorage.setItem("cpai_active", "1");

  // URL에서 q 파라미터가 있다면 세션에 보관
  try {
    const params = new URLSearchParams(location.search);
    const q = params.get("q");
    if (q) sessionStorage.setItem("cpai_prompt", q);
  } catch (e) {}

  const toast = (msg) => {
    const existing = document.getElementById("cpai-toast");
    if (existing) existing.remove();

    const t = document.createElement("div");
    t.id = "cpai-toast";
    t.textContent = msg;
    t.style.cssText = "position:fixed;left:50%;bottom:60px;transform:translateX(-50%);z-index:9999999;background:#111;color:#fff;padding:12px 22px;border-radius:99px;font-size:13.5px;font-weight:bold;box-shadow:0 6px 20px rgba(0,0,0,0.3);pointer-events:none;transition:all .3s ease;";
    document.body.appendChild(t);
    setTimeout(() => {
      t.style.opacity = "0";
      setTimeout(() => t.remove(), 400);
    }, 3500);
  };

  const done = () => {
    sessionStorage.setItem("cpai_sent", "1");
    sessionStorage.removeItem("cpai_prompt");
  };

  // 프롬프트 가져오기: 세션 캐시 → 클립보드 순서
  // ※ ?q= URL 파라미터 방식 제거됨 (ChatGPT가 즉시 자동제출해버려서 개입 불가)
  const getPrompt = async () => {
    let p = sessionStorage.getItem("cpai_prompt") || "";
    if (!p) {
      try {
        p = await navigator.clipboard.readText();
        // 클립보드에서 읽은 값을 세션에 캐싱 (반복 읽기 실패 방지)
        if (p && p.trim()) sessionStorage.setItem("cpai_prompt", p.trim());
      } catch (e) {}
    }
    return (p || "").trim();
  };

  // 입력창에 텍스트를 안정적으로 주입하는 헬퍼 함수
  const fillText = (el, text) => {
    el.focus();
    if (el.tagName && el.tagName.toLowerCase() === "textarea") {
      el.value = text;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }

    // contenteditable (ProseMirror / RichTextarea)
    try {
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (e) {}

    let inserted = false;
    try {
      const dt = new DataTransfer();
      dt.setData("text/plain", text);
      const pasteEvt = new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: dt,
      });
      el.dispatchEvent(pasteEvt);
      if (el.textContent && el.textContent.trim().length > 0) inserted = true;
    } catch (e) {}

    if (!inserted || !el.textContent || el.textContent.trim().length === 0) {
      try {
        document.execCommand("selectAll", false, null);
        inserted = document.execCommand("insertText", false, text);
      } catch (e) {}
    }

    if (!inserted || !el.textContent || el.textContent.trim().length === 0) {
      try {
        el.dispatchEvent(new InputEvent("beforeinput", {
          bubbles: true,
          cancelable: true,
          inputType: "insertText",
          data: text,
        }));
      } catch (e) {}
    }

    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return el.textContent && el.textContent.trim().length > 0;
  };

  // ---- ChatGPT 자동 입력 및 전송 ----
  const autoChatGPT = async () => {
    let prompt = await getPrompt();
    let tries = 0;
    let filled = false;

    const findComposer = () =>
      document.querySelector("div#prompt-textarea[contenteditable='true']") ||
      document.querySelector("div#prompt-textarea") ||
      document.querySelector("#prompt-textarea p")?.closest("div#prompt-textarea") ||
      document.querySelector("div[contenteditable='true'][data-placeholder]") ||
      document.querySelector("div[contenteditable='true'].ProseMirror") ||
      document.querySelector("div[data-testid='prompt-textarea']") ||
      document.querySelector("textarea#prompt-textarea") ||
      document.querySelector("textarea[data-testid='composer-text-input']") ||
      document.querySelector("div[contenteditable='true'][role='textbox']");

    // AIPRM 포함 모든 ChatGPT 환경 대응 전송 버튼 찾기
    const findSendBtn = () => {
      // 1순위: 표준 셀렉터
      const standard =
        document.querySelector("button[data-testid='send-button']") ||
        document.querySelector("button[aria-label='Send prompt']") ||
        document.querySelector("button[aria-label='메시지 보내기']") ||
        document.querySelector("button[aria-label*='보내기']") ||
        document.querySelector("button[aria-label*='전송']") ||
        document.querySelector("button[aria-label*='Send']") ||
        document.querySelector("button[data-testid='fruitjuice-send-button']") ||
        document.querySelector("button[data-testid='composer-submit-button']") ||
        document.querySelector("form button[type='submit']");
      if (standard) return standard;

      // 2순위: AIPRM 환경 — 입력창 근처 마지막 버튼 (파란 ↑ 버튼)
      const allBtns = [...document.querySelectorAll("button")].filter(b => b.offsetParent !== null);

      // SVG 아이콘 포함 + form 또는 composer 영역 안에 있는 버튼
      const inForm = allBtns.find(b =>
        b.querySelector("svg") && (b.closest("form") || b.closest("[class*='composer']") || b.closest("[class*='input']"))
      );
      if (inForm) return inForm;

      // 3순위: 화면 우하단에 있는 SVG 버튼 (AIPRM 파란 ↑ 버튼 위치)
      const byPosition = allBtns
        .filter(b => b.querySelector("svg"))
        .sort((a, b) => {
          const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
          return (rb.bottom + rb.right) - (ra.bottom + ra.right);
        })[0];
      return byPosition || null;
    };

    // 버튼 활성화 여부 — AIPRM은 disabled 표시를 다르게 해서 너그럽게 판별
    const isBtnReady = (btn) => {
      if (!btn) return false;
      if (btn.disabled) return false;
      if (btn.getAttribute("aria-disabled") === "true") return false;
      if (btn.getAttribute("data-disabled") === "true") return false;
      return true;
    };

    // Enter 키 전송 강화 폴백
    const sendViaEnter = (box) => {
      box.focus();
      ["keydown", "keypress", "keyup"].forEach(type => {
        box.dispatchEvent(new KeyboardEvent(type, {
          key: "Enter", code: "Enter", keyCode: 13, which: 13,
          bubbles: true, cancelable: true,
        }));
      });
    };

    const iv = setInterval(async () => {
      tries++;
      const box = findComposer();
      const btn = findSendBtn();

      // 아직 프롬프트를 못 구했다면 클립보드 재시도
      if (!prompt) {
        prompt = await getPrompt();
      }

      // 입력창이 나타났고 아직 채우지 않았다면 텍스트 주입
      if (box && prompt && (!box.textContent || box.textContent.trim().length === 0) && !filled) {
        fillText(box, prompt);
        filled = true;
      }

      const hasContent = box && box.textContent && box.textContent.trim().length > 0;
      const btnReady = isBtnReady(btn);

      // 텍스트가 있고 버튼 준비됐거나, 텍스트 채운 후 2초(8번) 지나면 강제 전송
      if (hasContent && (btnReady || (filled && tries > 8))) {
        clearInterval(iv);
        done();

        // AIPRM 환경: Enter 먼저 → 그래도 안 되면 버튼 click
        if (box) sendViaEnter(box);
        await new Promise(r => setTimeout(r, 300));
        if (btn) btn.click();

        toast("✦ 당근 Post AI: GPT가 소식지를 자동 작성 중입니다!");
      } else if (tries > 80) {
        clearInterval(iv);
        if (box && prompt && (!box.textContent || box.textContent.trim().length === 0)) {
          fillText(box, prompt);
        }
        toast("입력창에 내용이 채워졌습니다. [전송]을 눌러주세요.");
      }
    }, 250);
  };

  // ---- Gemini 자동 입력 및 전송 ----
  const autoGemini = async () => {
    let prompt = await getPrompt();
    let tries = 0;
    let filled = false;

    const findComposer = () =>
      document.querySelector("rich-textarea div[contenteditable='true']") ||
      document.querySelector("div[contenteditable='true']") ||
      document.querySelector("div[contenteditable='true'][role='textbox']");

    const findSendBtn = () =>
      document.querySelector("button[aria-label*='전송']") ||
      document.querySelector("button[aria-label*='보내기']") ||
      document.querySelector("button[aria-label*='Send']") ||
      [...document.querySelectorAll("button")].find((b) => b.querySelector("mat-icon[data-mat-icon-name='send']"));

    const iv = setInterval(async () => {
      tries++;
      const box = findComposer();
      const btn = findSendBtn();

      if (!prompt) {
        prompt = await getPrompt();
      }

      if (box && prompt && (!box.textContent || box.textContent.trim().length === 0) && !filled) {
        fillText(box, prompt);
        filled = true;
      }

      const hasContent = box && box.textContent && box.textContent.trim().length > 0;
      const btnReady = btn && !btn.disabled && btn.getAttribute("aria-disabled") !== "true";

      if (hasContent && (btnReady || tries > 25)) {
        clearInterval(iv);
        done();
        if (btnReady) {
          btn.click();
        } else if (box) {
          box.dispatchEvent(new KeyboardEvent("keydown", {
            key: "Enter",
            code: "Enter",
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true,
          }));
        }
        toast("✦ 당근 Post AI: Gemini가 소식지를 자동 작성 중입니다!");
      } else if (tries > 80) {
        clearInterval(iv);
        if (box && prompt && (!box.textContent || box.textContent.trim().length === 0)) {
          fillText(box, prompt);
        }
        toast("붙여넣기 후 전송을 눌러주세요 (Ctrl+V)");
      }
    }, 300);
  };

  const host = location.hostname;
  if (host.includes("chatgpt.com") || host.includes("chat.openai.com")) {
    autoChatGPT();
  } else if (host.includes("gemini.google.com")) {
    autoGemini();
  }
})();
