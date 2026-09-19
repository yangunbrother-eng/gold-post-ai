"use client";

// 미리보기 카드를 실제 PNG 파일로 저장 (외부 라이브러리 없이 canvas 직접 렌더)
function loadImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    let done = false;
    const finish = (v: HTMLImageElement | null) => { if (!done) { done = true; res(v); } };
    const im = new Image();
    im.onload = () => finish(im);
    im.onerror = () => finish(null);
    im.src = src;
    setTimeout(() => finish(null), 4000);
  });
}

export type ImageOpts = { copy: string; sub: string; bg: string; brand: string; logo?: string | null; filename?: string };

export async function renderImageCanvas(opts: ImageOpts): Promise<HTMLCanvasElement | null> {
  const W = 1200, H = 900;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = opts.bg || "#111111";
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";
  if (opts.logo) {
    const im = await loadImg(opts.logo);
    if (im) {
      ctx.save();
      ctx.beginPath(); ctx.arc(96, 96, 58, 0, Math.PI * 2); ctx.clip();
      ctx.drawImage(im, 38, 38, 116, 116);
      ctx.restore();
      ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(96, 96, 58, 0, Math.PI * 2); ctx.stroke();
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "bold 38px Pretendard, 'Apple SD Gothic Neo', sans-serif";
      ctx.fillText(opts.brand || "", 175, 110);
      ctx.textAlign = "center";
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "bold 34px Pretendard, 'Apple SD Gothic Neo', sans-serif";
      ctx.fillText(opts.brand || "", W / 2, 110);
    }
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "bold 34px Pretendard, 'Apple SD Gothic Neo', sans-serif";
    ctx.fillText(opts.brand || "", W / 2, 110);
  }

  // 메인 문구 줄바꿈 (한글 기준 글자 단위)
  const text = opts.copy || "당근 소식";
  const maxLen = 11;
  const lines: string[] = [];
  let cur = "";
  for (const ch of text) {
    cur += ch;
    if (cur.length >= maxLen && (ch === " " || cur.length >= maxLen + 2)) { lines.push(cur.trim()); cur = ""; if (lines.length === 2) break; }
  }
  if (cur.trim()) lines.push(cur.trim());
  const finalLines = lines.slice(0, 2);
  const size = finalLines.join("").length > 12 || finalLines.length > 1 ? 92 : 116;
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `900 ${size}px Pretendard, 'Apple SD Gothic Neo', sans-serif`;
  const startY = H / 2 - ((finalLines.length - 1) * size * 0.62);
  finalLines.forEach((ln, i) => ctx.fillText(ln, W / 2, startY + i * size * 1.25));

  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.font = "600 36px Pretendard, 'Apple SD Gothic Neo', sans-serif";
  ctx.fillText(opts.sub || "", W / 2, H - 120);

  return canvas;
}

export async function downloadImagePNG(opts: ImageOpts) {
  const canvas = await renderImageCanvas(opts);
  if (!canvas) return;
  const a = document.createElement("a");
  a.download = opts.filename || "carrot-image.png";
  a.href = canvas.toDataURL("image/png");
  a.click();
}

// 확장 전달용 JPEG (용량 절감)
export async function renderImageDataURL(opts: ImageOpts): Promise<string | null> {
  const canvas = await renderImageCanvas(opts);
  if (!canvas) return null;
  return canvas.toDataURL("image/jpeg", 0.88);
}
