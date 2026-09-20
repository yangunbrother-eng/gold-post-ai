// ChatGPT에서 확장프로그램 저장소로 전달된 이미지를 소식 만들기 페이지에 연결한다.
(function () {
  const BRIDGE_ID = "cpai-image-bridge";
  const TEXT_BRIDGE_ID = "cpai-text-bridge";

  const publish = (payload) => {
    if (!payload || !payload.requestId || !Array.isArray(payload.images) || !payload.images.length) return;
    let bridge = document.getElementById(BRIDGE_ID);
    if (!bridge) {
      bridge = document.createElement("div");
      bridge.id = BRIDGE_ID;
      bridge.hidden = true;
      (document.documentElement || document).appendChild(bridge);
    }
    bridge.setAttribute("data-payload", JSON.stringify(payload));
    window.dispatchEvent(new Event("cpai:generated-images"));
  };

  const publishText = (payload) => {
    if (!payload || !payload.requestId || typeof payload.text !== "string" || !payload.text.trim()) return;
    let bridge = document.getElementById(TEXT_BRIDGE_ID);
    if (!bridge) {
      bridge = document.createElement("div");
      bridge.id = TEXT_BRIDGE_ID;
      bridge.hidden = true;
      (document.documentElement || document).appendChild(bridge);
    }
    bridge.setAttribute("data-payload", JSON.stringify(payload));
    window.dispatchEvent(new Event("cpai:generated-text"));
  };

  const load = () => chrome.storage.local.get(["cpai_generated_images", "cpai_generated_text"], result => {
    publish(result.cpai_generated_images);
    publishText(result.cpai_generated_text);
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", load, { once: true });
  else load();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.cpai_generated_images?.newValue) publish(changes.cpai_generated_images.newValue);
    if (area === "local" && changes.cpai_generated_text?.newValue) publishText(changes.cpai_generated_text.newValue);
  });

  window.addEventListener("cpai:generated-images-consumed", () => {
    const bridge = document.getElementById(BRIDGE_ID);
    const consumedId = bridge?.getAttribute("data-consumed-id");
    if (!consumedId) return;
    chrome.storage.local.get("cpai_generated_images", result => {
      if (result.cpai_generated_images?.requestId === consumedId) chrome.storage.local.remove("cpai_generated_images");
    });
  });
  window.addEventListener("cpai:generated-text-consumed", () => {
    const bridge = document.getElementById(TEXT_BRIDGE_ID);
    const consumedId = bridge?.getAttribute("data-consumed-id");
    if (!consumedId) return;
    chrome.storage.local.get("cpai_generated_text", result => {
      if (result.cpai_generated_text?.requestId === consumedId) chrome.storage.local.remove("cpai_generated_text");
    });
  });
  window.addEventListener("cpai:publish-payload", () => {
    const raw = document.getElementById("cpai-publish-bridge")?.getAttribute("data-payload");
    if (!raw) return;
    try {
      const payload = JSON.parse(raw);
      if (!payload.title || !payload.body) return;
      const images = Array.isArray(payload.images) ? payload.images.slice(0, 2).map(image => ({
        slot: image.slot,
        dataUrl: image.dataUrl || image.url || null,
        url: image.url || null,
      })) : [];
      chrome.storage.local.set({ cpai_payload: { title: payload.title, body: payload.body, images } });
    } catch (e) {}
  });
  window.addEventListener("cpai:send-to-daangn", () => {
    const raw = document.getElementById("cpai-publish-bridge")?.getAttribute("data-payload");
    if (!raw) return;
    try {
      const payload = JSON.parse(raw);
      if (!payload.title || !payload.body) return;
      const images = Array.isArray(payload.images) ? payload.images.slice(0, 2).map(image => ({
        slot: image.slot,
        dataUrl: image.dataUrl || image.url || null,
        url: image.url || null,
      })) : [];
      chrome.storage.local.set({
        cpai_payload: { title: payload.title, body: payload.body, images },
        cpai_autofill_requested_at: Date.now(),
      }, () => chrome.runtime.sendMessage({ type: "cpai-open-daangn" }, response => {
        const status = document.getElementById("cpai-publish-bridge");
        status?.setAttribute("data-send-ok", response?.ok ? "true" : "false");
        window.dispatchEvent(new Event("cpai:send-to-daangn-result"));
      }));
    } catch (e) {}
  });
})();
