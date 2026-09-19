const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.resolve(__dirname, '../lib/mobile-gemini.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
function fixture(options = {}) {
  const events = [];
  const tab = { opener: {}, closed: !!options.closed, close() { this.closed = true; events.push('close'); }, location: { replace(url) { if (options.navigationError) throw new Error('blocked'); events.push(['navigate', url]); } } };
  const sandbox = { exports: {}, navigator: options.missingClipboard ? {} : { clipboard: { writeText(text) { events.push(['copy', text]); if (options.syncError) throw new Error('denied'); return options.copyTask || (options.copyError ? Promise.reject(new Error('denied')) : Promise.resolve()); } } }, window: { open(url, target) { events.push(['open', url, target]); if (options.openError) throw new Error('blocked'); return options.blocked ? null : tab; } } };
  vm.runInNewContext(compiled, sandbox);
  return { ...sandbox.exports, events, tab };
}
test('successful handoff copies text and opens only the Gemini web URL', async () => {
  const f = fixture(); const r = await f.launchMobileGemini('우리 가게 소식');
  assert.equal(r.copied, true); assert.equal(r.opened, true);
  assert.deepEqual(f.events, [['copy', '우리 가게 소식'], ['open', 'about:blank', '_blank'], ['navigate', 'https://gemini.google.com/app']]);
  assert.equal(f.tab.opener, null);
});
test('tab is reserved synchronously before the clipboard permission completes', async () => {
  let resolve; const copyTask = new Promise(r => { resolve = r; }); const f = fixture({ copyTask });
  const task = f.launchMobileGemini('요청');
  assert.equal(f.events[1][0], 'open'); assert.equal(f.events.length, 2);
  resolve(); assert.equal((await task).opened, true);
});
for (const options of [{ copyError: true }, { syncError: true }, { missingClipboard: true }]) {
  test(`copy failure keeps user on composer: ${JSON.stringify(options)}`, async () => {
    const f = fixture(options); const r = await f.launchMobileGemini('요청');
    assert.equal(r.copied, false); assert.equal(r.opened, false); assert.equal(f.tab.closed, true);
    assert.equal(f.events.some(e => Array.isArray(e) && e[0] === 'navigate'), false);
  });
}
for (const options of [{ blocked: true }, { openError: true }, { closed: true }, { navigationError: true }]) {
  test(`opening failure reports copied-only status: ${JSON.stringify(options)}`, async () => {
    const f = fixture(options); const r = await f.launchMobileGemini('요청');
    assert.equal(r.copied, true); assert.equal(r.opened, false);
  });
}
test('empty prompts neither read clipboard nor open tabs', async () => {
  const f = fixture(); const r = await f.launchMobileGemini('  ');
  assert.equal(r.copied, false); assert.equal(r.opened, false); assert.deepEqual(f.events, []);
});
test('mobile URL never carries prompt text or desktop auto-send markers', async () => {
  const f = fixture(); await f.launchMobileGemini('비공개 작업 내용');
  assert.equal(f.MOBILE_GEMINI_URL, 'https://gemini.google.com/app');
  assert.doesNotMatch(source, /fetch\s*\(|openHostAi\s*\(|cpai=1|readText\s*\(/);
});
const page = fs.readFileSync(path.resolve(__dirname, '../app/create/page.tsx'), 'utf8');
test('exactly four provider cards, site AI replaced in its existing position', () => {
  const block = page.slice(page.indexOf('const PROVIDERS:'), page.indexOf('const TYPE_MAP:'));
  assert.deepEqual(Array.from(block.matchAll(/name: "([^"]+)"/g), m => m[1]), ['ChatGPT', 'Gemini', '모바일 제미나이', '빠른 초안']);
  assert.doesNotMatch(page, /name: "사이트 AI"|setProvider\("auto"\)|fetch\("\/api\/generate-post"/);
  assert.match(page, /className="ws-provider-grid"/);
});
test('mobile uses its own handoff and preserves selected tone, length and type', () => {
  const mobile = page.slice(page.indexOf('if (provider === "gemini-mobile") {'), page.indexOf('if (provider === "chatgpt" || provider === "gemini") {'));
  assert.match(mobile, /launchMobileGemini\(prompt\)/); assert.match(mobile, /\[분량\] \$\{lenSel\}/); assert.match(mobile, /brand, effectiveTone, detected/);
  assert.doesNotMatch(mobile, /openHostAi\(|fetch\(/);
});
test('mobile exposes manual submission guidance, recovery link and result apply', () => {
  assert.match(page, /Gemini 입력창에 붙여넣고 직접 전송/);
  assert.match(page, /mobileMode && mobileIssue/);
  assert.match(page, /showPaste && \(provider === "chatgpt" \|\| provider === "gemini" \|\| mobileMode\)/);
  assert.match(page, /if \(!showPaste \|\| provider === "gemini-mobile"\) return;/);
  assert.match(page, /입력한 글 적용/);
});
test('TSX syntax/transpilation succeeds', () => {
  const result = ts.transpileModule(page, { fileName: 'page.tsx', reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } });
  assert.deepEqual((result.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')), []);
});
