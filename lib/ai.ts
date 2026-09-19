import { BrandSettings, ContentType, GeneratedPost } from "./types";

const pick = <T,>(arr: T[], seed: number) => arr[Math.abs(seed) % arr.length];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function detectType(input: string): ContentType {
  const t = input.toLowerCase();
  if (/시세|금값|가격|오늘.*금|相場/.test(input)) return "시세";
  if (/후기|리뷰|고객.*말|만족/.test(input)) return "고객 후기";
  if (/사례|실제|매입.*했|판매.*했/.test(input)) return "실제 사례";
  if (/상품|소개|제품|목걸이|반지|팔찌|금.*목걸이/.test(input)) return "상품 소개";
  if (/faq|질문|자주|궁금|문의/.test(input)) return "FAQ";
  if (/이벤트|할인|특가|사은품|프로모션/.test(input)) return "이벤트";
  if (/영업|쉬|휴무|정상.*영업|오늘.*영업|문.*열/.test(input)) return "영업 안내";
  if (/방문|찾아오|위치|주차|오시는/.test(input)) return "방문 안내";
  if (/정보|팁|알아|방법|가이드/.test(input)) return "정보성";
  if (/신뢰|솔직|이야기/.test(input)) return "후기형";
  if (/상담|예약|연락|전화/.test(input)) return "문의 유도형";
  void t;
  return "자유 주제";
}

const HOOKS: Record<string, string[]> = {
  "시세": [
    "오늘 금값 보고 깜짝 놀라셨죠? 지금 파는 게 맞을지 1분만 읽어보세요.",
    "어제보다 올랐습니다. 그런데 무조건 지금 팔아야 할까요?",
    "금값 매일 흔들리는데, 오늘 기준 정확히 정리해드립니다."
  ],
  "고객 후기": [
    "“생각보다 훨씬 더 받았습니다” 어제 방문하신 고객님의 첫마디였습니다.",
    "처음엔 걱정 가득한 얼굴로 들어오셨습니다.",
    "당근 보고 오셨다는 분이 어제만 세 분이셨어요."
  ],
  "영업 안내": [
    "오늘 정상 영업합니다. 방문 전 이것만 확인하세요.",
    "비 오는 날도 문 열려 있습니다. 오늘 영업 안내드립니다.",
    "주말에도 쉬지 않고 영업 중입니다."
  ],
  "FAQ": [
    "“이것도 매입되나요?” 가장 많이 받는 질문 TOP 3 정리했습니다.",
    "끊어진 목걸이, 한쪽 귀걸이… 버리기 전에 꼭 보세요.",
    "처음 오시는 분들이 가장 궁금해하는 3가지입니다."
  ],
  "default": [
    "이 글 하나면 오늘 궁금증이 해결됩니다.",
    "3분만 투자하세요. 방문 전후가 달라집니다.",
    "동네분들이 가장 많이 물어보시는 내용, 정리했습니다."
  ]
};

export function generatePost(input: string, brand: BrandSettings, tone: string, typeOverride?: ContentType, variantSeed = 0): GeneratedPost {
  const type = typeOverride && typeOverride !== "자유 주제" ? typeOverride : detectType(input);
  const seed = hashStr(input + tone + type + variantSeed + Date.now().toString().slice(-3));
  const hooks = HOOKS[type] ?? HOOKS["default"];
  const hook = pick(hooks, seed + variantSeed * 7);

  const addrParts = brand.address.split(" ");
  let place = addrParts.slice(0, 2).join(" ");
  if (/특별자치도|광역시|특별시|특별자치시/.test(addrParts[0] ?? "") && addrParts[1]) place = addrParts[1];
  const dong = brand.address.match(/\(([^)]+)\)/)?.[1];
  if (dong) place = `${place} ${dong}`;
  const shortTopic = input.trim().slice(0, 40) || "오늘의 소식";

  const toneIntro: Record<string, string> = {
    "친근한 상담형": "안녕하세요, 이웃님! 😊",
    "전문가형": "안녕하세요. 귀금속 매입 전문가입니다.",
    "정보 전달형": "오늘 꼭 필요한 정보만 정리해 전달드립니다.",
    "지역 친화형": `안녕하세요, ${place} 이웃 여러분!`,
    "부드러운 홍보형": "부담 없이 읽어보실 수 있게 정리했어요.",
    "광고 느낌 최소화": "광고 없이, 사실만 담백하게 정리합니다."
  };

  const greeting = toneIntro[tone] ?? toneIntro["친근한 상담형"];

  const titles: Record<string, string[]> = {
    "시세": [`오늘 금값, 지금 팔아도 될까요?`, `금값 올랐을 때 꼭 확인할 3가지`, `${place} 오늘 시세 기준 매입 안내`],
    "고객 후기": [`“여기서 팔길 잘했어요” 고객 후기`, `처음엔 걱정, 나중엔 만족하셨던 이유`, `당근 보고 오신 분의 솔직 후기`],
    "영업 안내": [`오늘 정상 영업합니다 (방문 안내)`, `주말에도 열려 있어요 — 오늘 영업 안내`, `방문 전 1분만 확인해주세요`],
    "FAQ": [`“이것도 되나요?” 자주 묻는 3가지`, `처음 오시는 분 필독! FAQ 정리`, `끊어져도 돼요, 한쪽만 있어도 돼요`],
    "default": [`${shortTopic} — 정리해드립니다`, `궁금하셨죠? ${shortTopic}`, `오늘 소식: ${shortTopic}`]
  };
  const titleList = titles[type] ?? titles["default"];
  const title = pick(titleList, seed + variantSeed * 13);

  let body = "";
  if (type === "시세") {
    body = `${greeting}\n\n${hook}\n\n오늘은 “${shortTopic}” 문의가 특히 많습니다.\n금값이 오르면 두 가지를 꼭 확인하셔야 합니다.\n\n1️⃣ 오늘 기준 실매입가 확인\n- 순금 1돈(3.75g) 기준으로 매일 고시가가 달라집니다.\n- 인터넷 시세와 실제 매입가는 수수료·함량 검정 방식에 따라 다릅니다.\n- 저희는 당일 고시가 기준으로 투명하게 안내드립니다.\n\n2️⃣ 지금 팔 타이밍인지 판단 기준\n- 급전이 필요하시면 오늘이 기회일 수 있습니다.\n- 여유가 있으시면 분할 매도를 추천드립니다.\n- “전부 팔지 말고 일부만”도 가능합니다.\n\n3️⃣ 방문 전 준비물\n- 신분증 하나만 챙겨오세요.\n- 끊어진 제품, 한쪽 귀걸이도 모두 감정 가능합니다.\n- 감정·상담은 무료, 매입 강요 없습니다.\n\n${brand.businessName}은 ${brand.hours} 운영하며, ${brand.address}에 있습니다.\n${brand.defaultCta}`;
  } else if (type === "고객 후기" || type === "후기형") {
    body = `${greeting}\n\n${hook}\n\n어제 방문해주신 40대 고객님 이야기입니다.\n서랍에 10년 묵은 끊어진 목걸이와 돌반지 하나를 가져오셨어요.\n“이게 돈이 될까?” 반신반의하셨죠.\n\n✔ 정밀 저울·함량 검정 과정을 직접 보여드렸고\n✔ 당일 시세 기준 계산식을 종이에 적어 설명드렸고\n✔ 부담되시면 일부만 파셔도 된다고 안내드렸습니다.\n\n결과적으로 예상보다 15% 이상 더 받으셨고,\n“설명 듣고 나니 속이 시원하다”며 이웃분께 소개까지 해주셨습니다.\n\n${brand.businessName}은 후기 이벤트보다 이런 신뢰가 더 소중하다고 생각합니다.\n${brand.defaultCta}`;
  } else if (type === "영업 안내") {
    body = `${greeting}\n\n${hook}\n\n📍 ${brand.businessName}\n📌 ${brand.address}\n⏰ ${brand.hours}\n📞 ${brand.phone}\n\n• ${brand.intro}\n• 방문 상담 5~10분, 예약 없이 가능합니다.\n• 주차·대중교통 안내가 필요하시면 전화주세요.\n• 오늘도 ${brand.phrases[0] ?? "정직한 감정으로 모시겠습니다."}\n\n${brand.defaultCta}`;
  } else if (type === "FAQ") {
    body = `${greeting}\n\n${hook}\n\nQ1. 끊어진 목걸이도 매입되나요?\n→ 네, 중량·함량 기준이라 끊어져도 동일하게 매입됩니다.\n\nQ2. 한쪽 귀걸이, 이물질 낀 제품도 되나요?\n→ 가능합니다. 세척·감정 후 정확히 안내드립니다.\n\nQ3. 신분증이 꼭 필요한가요?\n→ 네, 귀금속 매입 시 신분 확인은 필수입니다. (매매서 작성)\n\n그 외 “${shortTopic}” 관련 질문도 편하게 물어보세요.\n${brand.defaultCta}`;
  } else {
    body = `${greeting}\n\n${hook}\n\n오늘 주제: “${shortTopic}”\n\n이웃분들이 헷갈려하시는 부분을 3가지로 정리했습니다.\n\n✔ 핵심 1 — 눈앞의 가격보다 ‘실수령액’이 중요합니다.\n인터넷 시세와 매장 매입가는 검정 방식이 다릅니다. 저희는 계산 과정을 직접 보여드립니다.\n\n✔ 핵심 2 — 상태가 안 좋아도 괜찮습니다.\n끊어짐·변색·한쪽 분실 모두 중량 기준으로 평가합니다. 버리기 전에 감정부터 받아보세요.\n\n✔ 핵심 3 — 부담 없는 상담이 우선입니다.\n${brand.intro} ${brand.defaultCta}\n\n📍 ${brand.address} / ${brand.hours}`;
  }

  const coreMessage = type === "시세" ? "오늘 시세 기준, 투명한 실매입가 안내" : type === "FAQ" ? "버리기 전 감정 먼저" : type === "영업 안내" ? "오늘 정상 영업 · 예약 없이 방문 가능" : "정직한 설명과 투명한 계산";
  const imageCopy = type === "시세" ? "오늘 금값 확인하세요" : type === "FAQ" ? "이것도 매입될까요?" : type === "영업 안내" ? "오늘 정상 영업합니다" : title.length > 14 ? title.slice(0, 14) : title;
  const hashtags = [`#${place.replace(/ /g, "")}`, "#당근비즈프로필", `#${type.replace(/ /g, "")}`, "#금매입", "#무료감정"];

  return {
    title, hook, body, coreMessage,
    cta: brand.defaultCta,
    imageCopy,
    imageSubCopy: brand.businessName + " · " + brand.hours,
    hashtags, type
  };
}

export function rewritePost(post: GeneratedPost, mode: string, brand: BrandSettings): GeneratedPost {
  const p = { ...post };
  if (mode === "short") {
    const lines = p.body.split("\n").filter(Boolean).slice(0, 9);
    p.body = lines.join("\n") + `\n\n${brand.defaultCta}`;
  } else if (mode === "long") {
    p.body = p.body + `\n\n➕ 덧붙임 — 이런 분께 특히 추천합니다.\n• 오래된 돌반지·예물 처분이 고민인 분\n• 급전이 필요한데 대출은 부담스러운 분\n• 시세 타이밍이 궁금한 분\n\n${brand.businessName}은 모든 감정 과정을 눈앞에서 공개합니다. 비교 상담도 환영합니다.\n${brand.defaultCta}`;
  } else if (mode === "friendly") {
    p.body = "안녕하세요, 이웃님! 😊\n\n" + p.body.replace(/^.*?\n\n/, "") + "\n\n편하게 댓글·채팅 주세요, 바로 답드릴게요! 🙌";
    p.cta = "편하게 채팅 주세요! 바로 답변드릴게요 🙌";
  } else if (mode === "pro") {
    p.body = "안녕하세요. 귀금속 매입 전문가입니다.\n\n" + p.body.replace(/^.*?\n\n/, "") + `\n\n※ 당일 고시 기준 / 정밀 검정 / 매매서 작성 원칙을 준수합니다.`;
    p.cta = "정확한 감정이 필요하시면 방문해 주십시오. 무료 감정해 드립니다.";
  } else if (mode === "soft") {
    p.body = p.body.replace(/😊|🙌|‼️|!/g, ".").replace(/무조건|무료!!/g, "편하게");
    p.cta = "부담 없이 들러서 상담만 받아보세요.";
  } else if (mode === "hook") {
    p.hook = "⚡ 10초만 보세요. 이걸 모르면 손해 볼 수 있습니다. " + p.hook;
    p.body = p.body.replace(p.body.split("\n")[1] ?? "", p.hook);
    p.title = "⚡ " + p.title.replace(/^⚡\s*/, "");
  } else if (mode === "cta") {
    p.cta = "📩 지금 바로 ‘채팅하기’로 사진만 보내주세요. 5분 안에 예상 매입가를 알려드립니다. 방문 예약도 채팅으로 가능합니다!";
    p.body = p.body.replace(brand.defaultCta, p.cta);
    if (!p.body.includes(p.cta)) p.body += "\n\n" + p.cta;
  } else if (mode === "info") {
    p.type = "정보성";
    p.title = p.title.replace(/후기|이벤트|영업/g, "정리");
  } else if (mode === "review") {
    p.type = "후기형";
    if (!p.body.includes("고객님")) p.body = "어제 방문 고객님 이야기입니다.\n\n" + p.body;
  } else if (mode === "different") {
    p.title = "[새 관점] " + p.title;
    p.hook = "같은 이야기, 다르게 들립니다. 결론부터 말씀드릴게요. " + p.hook;
    const paras = p.body.split("\n\n");
    p.body = [...paras].reverse().join("\n\n");
  }
  return p;
}

export function checkSimilarity(newBody: string, recent: { title: string; body: string }[]): number {
  if (!recent.length) return 0;
  const tokenize = (s: string) => new Set(s.replace(/[^\uac00-\ud7a3a-zA-Z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length >= 2));
  const a = tokenize(newBody);
  let max = 0;
  for (const r of recent) {
    const b = tokenize(r.title + " " + r.body);
    let inter = 0;
    a.forEach((w) => { if (b.has(w)) inter++; });
    const score = inter / Math.max(1, Math.min(a.size, b.size));
    max = Math.max(max, score);
  }
  return Math.round(max * 100);
}

export function suggestTitles(post: GeneratedPost): string[] {
  const base = post.title.replace(/^⚡\s*|^\[새 관점\]\s*/g, "");
  return [
    `Q. ${base} — 1분 정리`,
    `${base} (방문 전 필독)`,
    `이웃님들이 가장 궁금해한: ${base}`,
    `${base} — 오늘 기준`,
    `솔직히 정리합니다: ${base}`
  ];
}
