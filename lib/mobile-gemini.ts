/** Mobile handoff is deliberately separate from extension-assisted desktop tabs. */
export const MOBILE_GEMINI_URL = "https://gemini.google.com/app";
export type MobileGeminiResult = { copied: boolean; opened: boolean };

/** Call directly from a click. No API request, extension marker or automatic submission. */
export async function launchMobileGemini(prompt: string): Promise<MobileGeminiResult> {
  if (!prompt.trim()) return { copied: false, opened: false };
  let copying: Promise<boolean>;
  try {
    copying = navigator.clipboard?.writeText(prompt).then(() => true).catch(() => false)
      ?? Promise.resolve(false);
  } catch { copying = Promise.resolve(false); }

  // Reserve the new tab before awaiting clipboard permissions to retain the click activation.
  // The original editor stays open. Disconnect opener before any cross-origin navigation.
  let tab: Window | null = null;
  try {
    tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
  } catch { /* The composer exposes a normal link when popup creation is denied. */ }
  const close = () => { try { tab?.close(); } catch { /* Already closed or restricted. */ } };
  const copied = await copying;
  if (!copied) { close(); return { copied: false, opened: false }; }
  try {
    if (!tab || tab.closed) return { copied: true, opened: false };
    tab.location.replace(MOBILE_GEMINI_URL);
    return { copied: true, opened: true };
  } catch {
    close();
    return { copied: true, opened: false };
  }
}
