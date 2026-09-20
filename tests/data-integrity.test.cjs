const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(name) {
  const source = fs.readFileSync(path.join(__dirname, '../lib/', name + '.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const result = {}; new Function('exports', code)(result); return result;
}
const { safeNextPath } = load('auth');
const { mergeDaangnPosts } = load('daangn-posts');
const post = {url:'https://www.daangn.com/kr/business-post/example/',title:'금 소식',shop:'금박사',views:100,interest:2,comments:0,thumbnail:'',createdAt:'2026-09-01',checkedAt:'2026-09-20T00:00:00Z'};
test('login redirect keeps local query and rejects external or normalized external paths', () => {
  assert.equal(safeNextPath('/create?topic=gold'), '/create?topic=gold');
  for (const value of ['//example.com', '/\\example.com', '/\n/example.com', 'https://example.com', null]) assert.equal(safeNextPath(value), '/');
});
test('older server snapshot cannot overwrite newer collected view counts', () => {
  assert.deepEqual(mergeDaangnPosts([post], [{...post, views:10, checkedAt:'2026-09-19', saved:true}]), [post]);
});
test('newer observation replaces matching post without duplicates', () => {
  const next = {...post, views:120, checkedAt:'2026-09-21'};
  assert.deepEqual(mergeDaangnPosts([post], [next, next]), [next]);
});
test('corrupt browser cache does not crash or add unsafe links', () => {
  assert.deepEqual(mergeDaangnPosts([post], [null, {}, {...post,url:'javascript:alert(1)'}, {...post,views:'broken'}]), [post]);
  assert.deepEqual(mergeDaangnPosts([post], {}), [post]);
});
