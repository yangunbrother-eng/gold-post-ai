// 당근 비즈프로필이 사진 버튼을 누를 때 만드는 임시 file input에 AI 이미지를 전달한다.
(function () {
  const dataUrlToFile = (item, index) => {
    try {
      const [header, encoded] = item.dataUrl.split(",", 2);
      const mime = item.type || header.match(/^data:([^;]+)/)?.[1] || "image/jpeg";
      const binary = atob(encoded);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return new File([bytes], item.name || `carrot-ai-${index + 1}.jpg`, { type: mime });
    } catch { return null; }
  };

  const assign = (input, files) => {
    const dt = new DataTransfer();
    files.forEach(file => dt.items.add(file));
    input.files = dt.files;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };

  document.addEventListener("cpai-daangn-upload", (event) => {
    const files = (event.detail?.files || []).map(dataUrlToFile).filter(Boolean);
    if (!files.length) {
      document.dispatchEvent(new CustomEvent("cpai-daangn-upload-result", { detail: { ok: false } }));
      return;
    }

    const existing = document.querySelector("input[type='file']");
    if (existing) {
      try {
        assign(existing, files);
        document.dispatchEvent(new CustomEvent("cpai-daangn-upload-result", { detail: { ok: true } }));
      } catch {
        document.dispatchEvent(new CustomEvent("cpai-daangn-upload-result", { detail: { ok: false } }));
      }
      return;
    }

    const originalClick = HTMLInputElement.prototype.click;
    let handled = false;
    const restore = () => { HTMLInputElement.prototype.click = originalClick; };
    HTMLInputElement.prototype.click = function (...args) {
      if (!handled && this.type === "file") {
        handled = true;
        restore();
        try {
          assign(this, files);
          document.dispatchEvent(new CustomEvent("cpai-daangn-upload-result", { detail: { ok: true } }));
        } catch {
          document.dispatchEvent(new CustomEvent("cpai-daangn-upload-result", { detail: { ok: false } }));
        }
        return;
      }
      return originalClick.apply(this, args);
    };

    const camera = [...document.querySelectorAll("button")].find(button => /^\d+\s*\/\s*10$/.test(button.textContent.trim()));
    if (!camera) {
      restore();
      document.dispatchEvent(new CustomEvent("cpai-daangn-upload-result", { detail: { ok: false } }));
      return;
    }
    camera.click();
    setTimeout(() => {
      restore();
      if (!handled) document.dispatchEvent(new CustomEvent("cpai-daangn-upload-result", { detail: { ok: false } }));
    }, 3000);
  });
})();
