/**
 * Parse copied AI replies without treating a whole paragraph as the title.
 * Keep hashtags in body for existing composer/export callers; they also derive
 * the editable hashtag field from body. Never return a hashtag-only body.
 */
export type PastedPost = { title: string; body: string };
const EMPTY: PastedPost = { title: "", body: "" };
type Section = "title" | "body" | "tags";
const TAG = /#[^\s#]+/g;
// Construct dynamically to stay compatible with the app's ES5 TypeScript target.
const PROSE = new RegExp("[\\p{L}\\p{N}]", "u");

function normalize(text: string): string {
  return text.replace(/\r\n?/g, "\n").replace(/[\u2028\u2029]/g, "\n")
    .replace(/[\u200B\uFEFF]/g, "").replace(/\u00a0/g, " ").trim();
}
function unFence(text: string): string {
  const match = /^(?:```|~~~)[^\n]*\n([\s\S]*?)\n(?:```|~~~)\s*$/.exec(text);
  return match ? match[1].trim() : text;
}
function cleanTitle(text: string): string {
  return text.trim().replace(/^#{1,6}\s+/, "").replace(/^(?:\*\*|__)([\s\S]*?)(?:\*\*|__)$/, "$1")
    .replace(/^["“'‘「]|["”'’」]$/g, "").trim();
}
function hasProse(text: string): boolean {
  const prose = text.replace(TAG, "").replace(/(?:^|\n)\s*(?:해시태그|hashtags?|태그)\s*[:：]?/gi, "");
  return PROSE.test(prose);
}
function compact(lines: string[]): string {
  return lines.join("\n").trim();
}
function firstContent(lines: string[]): number {
  return lines.findIndex(line => !!line.trim() && !/^\s*(?:---+|\*\*\*+|___+)\s*$/.test(line));
}
function suggestedTitle(body: string): string {
  const first = body.split("\n").find(line => hasProse(line)) || "제목 없는 소식";
  const title = cleanTitle(first);
  return title.length > 40 ? `${title.slice(0, 40).trimEnd()}…` : title;
}
function finish(title: string, body: string, tags = ""): PastedPost {
  const content = body.trim();
  if (!hasProse(content)) return { ...EMPTY };
  const heading = cleanTitle(title) || suggestedTitle(content);
  return { title: heading, body: [content, tags.trim()].filter(Boolean).join("\n\n") };
}

function jsonPost(text: string): PastedPost | null {
  if (!text.startsWith("{")) return null;
  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    const body = record.body ?? record.본문 ?? record.content;
    if (typeof body !== "string") return null;
    const title = record.title ?? record.제목;
    const source = record.hashtags ?? record.해시태그 ?? record.tags;
    const tags = Array.isArray(source) ? source.filter((tag): tag is string => typeof tag === "string")
      : typeof source === "string" ? source.split(/[,\s]+/) : [];
    const unique = Array.from(new Set(tags.map(tag => tag.trim()).filter(Boolean).map(tag => tag.startsWith("#") ? tag : `#${tag}`)))
      .filter(tag => !body.includes(tag));
    return finish(typeof title === "string" ? title : "", normalize(body), unique.join(" "));
  } catch { return null; }
}

export function splitPasted(value: string): PastedPost {
  let text = unFence(normalize(value));
  if (!text) return { ...EMPTY };
  const json = jsonPost(text);
  if (json) return json;

  // Some copy buttons supply literal \\n instead of real newlines. Only decode
  // this for labelled replies, not arbitrary paths or prose containing a slash.
  if (/\\n/.test(text) && /(?:제목|본문|title|body)\s*[:：]/i.test(text)) {
    text = text.replace(/\\r\\n|\\n|\\r/g, "\n");
  }

  // Labels may be plain, **bold**, Markdown headings or [bracketed], and the
  // title and body may be on the SAME line. Capture positions, not line count.
  const marker = /(^|\s)(?:#{1,6}[ \t]+)?(?:\*{1,2}|__)?(?:\[(제목|본문|해시태그|title|body|hashtags?)\](?:\*{1,2}|__)?[ \t]*[:：]?[ \t]*|(제목|본문|해시태그|title|body|hashtags?)(?:\*{1,2}|__)?[ \t]*(?:[:：][ \t]*(?:\*{1,2}|__)?[ \t]*|(?=\n|$)))/gi;
  const sections: { kind: Section; start: number; end: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = marker.exec(text))) {
    const label = (match[2] || match[3]).toLowerCase();
    const kind: Section = label === "제목" || label === "title" ? "title"
      : label === "본문" || label === "body" ? "body" : "tags";
    sections.push({ kind, start: match.index, end: marker.lastIndex });
  }

  const hasTitle = sections.some(section => section.kind === "title");
  const hasBody = sections.some(section => section.kind === "body");
  if (hasTitle || hasBody) {
    let title = "";
    const body: string[] = [];
    const tags: string[] = [];
    // Preserve a title before an explicit body label, e.g. '# Heading\n본문:'.
    const intro = text.slice(0, sections[0].start).trim();
    if (!hasTitle && intro) title = cleanTitle(intro);
    for (let index = 0; index < sections.length; index++) {
      const section = sections[index];
      const chunk = unFence(text.slice(section.end, sections[index + 1]?.start ?? text.length).trim());
      if (section.kind === "tags") { if (chunk) tags.push(chunk); continue; }
      if (section.kind === "body") { if (chunk) body.push(chunk); continue; }
      const lines = chunk.split("\n");
      const first = firstContent(lines);
      if (first < 0) continue;
      if (!title) {
        title = cleanTitle(lines[first]);
        // A title label does not imply that every line until the next label is
        // the title. Keep any subsequent paragraphs as body, even without 본문:.
        const rest = compact(lines.slice(first + 1));
        if (rest) body.push(rest);
      } else if (chunk) {
        // Repeated '제목:' inside a reply must not erase already collected prose.
        body.push(`제목: ${chunk}`);
      }
    }
    return finish(title, body.join("\n\n"), tags.join("\n"));
  }

  // No labelled title/body: separate a final hashtag section, but do not invent
  // prose from a hashtag-only clipboard. Long first paragraphs stay in body.
  const tagSection = sections.find(section => section.kind === "tags");
  const textBody = (tagSection ? text.slice(0, tagSection.start) : text).trim();
  const tags = tagSection ? unFence(text.slice(tagSection.end).trim()) : "";
  if (!hasProse(textBody)) return { ...EMPTY };
  const lines = textBody.split("\n");
  const first = firstContent(lines);
  if (first < 0) return { ...EMPTY };
  const heading = cleanTitle(lines[first]);
  const rest = compact(lines.slice(first + 1));
  const isHeading = /^\s*(?:#{1,6}\s|\*\*|__)/.test(lines[first]);
  if ((heading.length <= 80 || isHeading) && hasProse(rest)) return finish(heading, rest, tags);
  if (rest && !hasProse(rest) && heading.length <= 80) return { ...EMPTY };
  if (isHeading || (tagSection && heading.length <= 80 && !rest)) return { ...EMPTY };
  return finish("", textBody, tags);
}
