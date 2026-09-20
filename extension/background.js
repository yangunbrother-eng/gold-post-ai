const ALLOWED_IMAGE_HOSTS = [
  /(^|\.)oaiusercontent\.com$/i,
  /(^|\.)oaistatic\.com$/i,
  /(^|\.)blob\.core\.windows\.net$/i,
  /(^|\.)googleusercontent\.com$/i,
];

const toBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "cpai-open-daangn") {
    const composeUrl = "https://bizprofile.daangn.com/biz_accounts/1132417/manager/posts/new/?entry=business_profile.post.manage";
    chrome.tabs.query({ url: "https://bizprofile.daangn.com/*" }, tabs => {
      const target = tabs.find(tab => tab.url?.includes("/biz_accounts/1132417/manager/posts/new"));
      if (!target?.id) {
        chrome.tabs.create({ url: composeUrl, active: true });
        sendResponse({ ok: true, opened: true });
        return;
      }
      chrome.tabs.update(target.id, { active: true }, () => {
        chrome.tabs.sendMessage(target.id, { type: "cpai-autofill" }, () => void chrome.runtime.lastError);
        sendResponse({ ok: true, opened: false });
      });
    });
    return true;
  }
  if (message?.type !== "cpai-fetch-image" || typeof message.url !== "string") return false;
  let url;
  try { url = new URL(message.url); } catch { sendResponse({ error: "bad_url" }); return false; }
  if (url.protocol !== "https:" || !ALLOWED_IMAGE_HOSTS.some(pattern => pattern.test(url.hostname))) {
    sendResponse({ error: "host_not_allowed" });
    return false;
  }
  fetch(url.href, { credentials: "include" })
    .then(async response => {
      if (!response.ok) throw new Error("download_failed");
      const blob = await response.blob();
      if (!blob.type.startsWith("image/") || blob.size > 20 * 1024 * 1024) throw new Error("invalid_image");
      return { dataUrl: `data:${blob.type};base64,${toBase64(await blob.arrayBuffer())}` };
    })
    .then(sendResponse)
    .catch(() => sendResponse({ error: "download_failed" }));
  return true;
});
