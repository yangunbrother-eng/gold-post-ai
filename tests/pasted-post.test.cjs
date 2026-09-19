const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

const filename = path.join(__dirname, '../lib/pasted-post.ts');
const { outputText, diagnostics } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  reportDiagnostics: true,
});
assert.equal(diagnostics.length, 0, 'parser must compile');
const exported = {};
new Function('exports', outputText)(exported);
const { splitPasted } = exported;
const title = '끊어진 금목걸이도 상담해 드려요';
const body = '끊어져서 보관만 하던 목걸이가 있나요?\n\n상태를 확인한 뒤 매입 가능 여부를 안내해 드려요.\n제주점 방문 전에 문의해 주세요.';
const tags = '#제주금매입 #금박사';
const expected = { title, body: `${body}\n\n${tags}` };

for (const [name, text] of [
  ['plain labelled reply', `제목: ${title}\n본문:\n${body}\n해시태그: ${tags}`],
  ['title and body start on one line', `제목: ${title} 본문: ${body}\n해시태그: ${tags}`],
  ['separate value after title label', `제목:\n${title}\n\n본문:\n${body}\n\n해시태그:\n${tags}`],
  ['bold labels with colon inside', `**제목:** ${title}\n\n**본문:**\n${body}\n\n**해시태그:** ${tags}`],
  ['bold labels with colon outside', `**제목**: ${title}\n**본문**: ${body}\n**해시태그**: ${tags}`],
  ['Markdown headings', `## 제목\n${title}\n\n## 본문\n${body}\n\n## 해시태그\n${tags}`],
  ['bracketed labels', `[제목] ${title}\n[본문]\n${body}\n[해시태그] ${tags}`],
  ['full-width colons', `제목： ${title}\n본문：\n${body}\n해시태그：${tags}`],
  ['English labels', `Title: ${title}\nBody:\n${body}\nHashtags: ${tags}`],
  ['CRLF clipboard', `제목: ${title}\r\n본문:\r\n${body.replaceAll('\n', '\r\n')}\r\n해시태그: ${tags}`],
  ['literal escaped newlines', `제목: ${title}\\n본문:\\n${body.replaceAll('\n', '\\n')}\\n해시태그: ${tags}`],
  ['outer text code block', `\`\`\`text\n제목: ${title}\n본문:\n${body}\n해시태그: ${tags}\n\`\`\``],
  ['Unicode separators', `제목: ${title}\u2028본문:\u2028${body.replaceAll('\n', '\u2028')}\u2028해시태그: ${tags}`],
  ['labelled title but no body label', `제목: ${title}\n\n${body}\n해시태그: ${tags}`],
  ['plain heading followed by body label', `# ${title}\n본문:\n${body}\n해시태그: ${tags}`],
  ['plain heading followed by prose', `${title}\n\n${body}\n해시태그: ${tags}`],
]) {
  test(name, () => assert.deepEqual(splitPasted(text), expected));
}

test('regression: body is not replaced by final hashtags after a collapsed first line', () => {
  const prose = '버리지 말고 먼저 문의해 주세요. 상태 확인 후 상담해 드려요.';
  const result = splitPasted(`제목: ${title} 본문: ${prose}\n해시태그: ${tags}`);
  assert.equal(result.title, title);
  assert.equal(result.body, `${prose}\n\n${tags}`);
});
test('all labelled sections on a single line', () => {
  assert.deepEqual(splitPasted(`제목: ${title} 본문: 방문 전 문의해 주세요. 해시태그: ${tags}`), {
    title, body: `방문 전 문의해 주세요.\n\n${tags}`,
  });
});
test('JSON reply retains body and hashtags', () => {
  assert.deepEqual(splitPasted(JSON.stringify({ title, body, hashtags: tags.split(' ') })), expected);
});
test('fenced JSON and Korean field names', () => {
  assert.deepEqual(splitPasted('```json\n' + JSON.stringify({ 제목: title, 본문: body, 해시태그: ['제주금매입', '금박사'] }, null, 2) + '\n```'), expected);
});
test('single long paragraph remains body instead of becoming the title', () => {
  const paragraph = '오래 보관한 금목걸이가 있으신가요? '.repeat(8).trim();
  const result = splitPasted(`${paragraph}\n\n${tags}`);
  assert.ok(result.title.length <= 41);
  assert.equal(result.body, `${paragraph}\n\n${tags}`);
});
test('body-only reply is preserved and receives an editable title', () => {
  assert.equal(splitPasted(`본문: ${body}\n해시태그: ${tags}`).body, expected.body);
});
test('unlabelled single paragraph is not discarded', () => {
  const text = '오늘도 방문 전에 문의해 주세요.';
  assert.equal(splitPasted(text).body, text);
});
test('normal inline hashtags and address lines remain in the body', () => {
  const prose = '저희 #제주 매장에서 상담해 드려요.\n주소: 제주도 연북로\n전화: 문의해주세요';
  assert.equal(splitPasted(`제목: ${title}\n본문: ${prose}`).body, prose);
});
for (const [name, text] of [
  ['empty input', ' \n\n '],
  ['only hashtags on one line', tags],
  ['only hashtags on multiple lines', tags.replaceAll(' ', '\n')],
  ['label and hashtags', `해시태그:\n${tags}`],
  ['punctuated hashtags only', '#제주-금매입 #금박사_제주 #금매입💛'],
  ['bold label and hashtags', `**해시태그:**\n${tags}`],
  ['title then hashtags but no prose', `제목: ${title}\n해시태그: ${tags}`],
  ['body label then hashtags but no prose', `제목: ${title}\n본문:\n${tags}`],
  ['plain title then hashtag-only remainder', `${title}\n${tags}`],
  ['labelled heading then hashtag-only remainder', `${title}\n해시태그: ${tags}`],
  ['JSON with hashtag-only body', JSON.stringify({ title, body: tags })],
]) {
  test(`reject ${name} without replacing an existing draft`, () => assert.deepEqual(splitPasted(text), { title: '', body: '' }));
}

test('composer contract: input -> apply -> current draft and tags keep the prose', () => {
  // The production page applies the parsed title/body and passes that same body
  // to ImageStudio; preserve that contract, including its readTags(body) call.
  const parsed = splitPasted(`제목: ${title} 본문: ${body}\n해시태그: ${tags}`);
  assert.ok(parsed.title && parsed.body);
  const state = { title: parsed.title, body: parsed.body, hashtags: [...new Set(parsed.body.match(/#[^\s#]+/g) || [])] };
  const currentDraft = { title: state.title, body: state.body, hashtags: state.hashtags };
  assert.ok(currentDraft.body.startsWith('끊어져서'));
  assert.ok(currentDraft.body.includes('상태를 확인한 뒤'));
  assert.deepEqual(currentDraft.hashtags, tags.split(' '));
});
test('composer contract: hashtag-only copy does not overwrite the draft', () => {
  const state = { title, body };
  const parsed = splitPasted(`해시태그:\n${tags}`);
  if (parsed.title && parsed.body) Object.assign(state, parsed);
  assert.deepEqual(state, { title, body });
});
