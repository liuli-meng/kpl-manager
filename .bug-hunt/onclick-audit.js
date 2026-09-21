// A. onclick 静态完整性 — 比 tests/audit-static.js 更全
// 扫 src/**.js + game.html 中 onclick/onchange/oninput/onsubmit 的回调是否定义
// 运行: node .bug-hunt/onclick-audit.js
// 产出: stdout JSON + 写入 .bug-hunt/onclick-audit-result.json
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC_JS = path.join(ROOT, 'src', 'js');
const SRC_HTML = path.join(ROOT, 'src', 'index.html');
const GAME_HTML = path.join(ROOT, 'game.html');

function read(p) { return fs.readFileSync(p, 'utf8'); }

function listSrcJs() {
  return fs.readdirSync(SRC_JS).filter(f => f.endsWith('.js')).map(f => ({
    name: f,
    path: path.join(SRC_JS, f),
    text: read(path.join(SRC_JS, f)),
  }));
}

const files = listSrcJs();
const srcCode = files.map(f => f.text).join('\n');
const srcHtml = fs.existsSync(SRC_HTML) ? read(SRC_HTML) : '';
const gameHtml = fs.existsSync(GAME_HTML) ? read(GAME_HTML) : '';
const allSrc = srcCode + '\n' + srcHtml;

/* ---------- 1. 收集定义 ---------- */
const defined = new Map(); // name -> [{file,line,kind}]
function addDef(name, file, line, kind) {
  if (!name) return;
  if (!defined.has(name)) defined.set(name, []);
  defined.get(name).push({ file, line, kind });
}

files.forEach(f => {
  const lines = f.text.split(/\r?\n/);
  lines.forEach((ln, i) => {
    // function foo( / function foo ()
    let m;
    const reFn = /function\s+([A-Za-z_$][\w$]*)\s*\(/g;
    while ((m = reFn.exec(ln))) addDef(m[1], f.name, i + 1, 'function');
    // const/let/var foo = function / foo = () => / foo = async (
    const reAssign = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/g;
    while ((m = reAssign.exec(ln))) addDef(m[1], f.name, i + 1, 'const-fn');
    // foo: function / foo: ( in object literals (rough)
    const reProp = /(?:^|[{,\s])([A-Za-z_$][\w$]*)\s*:\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>)/g;
    while ((m = reProp.exec(ln))) addDef(m[1], f.name, i + 1, 'prop-fn');
    // window.foo = function / window['foo'] =
    const reWin = /window(?:\.|\[['"])([A-Za-z_$][\w$]*)/g;
    while ((m = reWin.exec(ln))) addDef(m[1], f.name, i + 1, 'window-assign');
    // this.foo = function
    const reThis = /\bthis\.([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\()/g;
    while ((m = reThis.exec(ln))) addDef(m[1], f.name, i + 1, 'this-assign');
  });
  // 跨行 function foo(\n
  const reMultiline = /function\s+([A-Za-z_$][\w$]*)\s*\(\s*[\r\n]/g;
  let mm;
  while ((mm = reMultiline.exec(f.text))) {
    const before = f.text.slice(0, mm.index);
    const line = before.split(/\r?\n/).length;
    addDef(mm[1], f.name, line, 'function-multiline');
  }
});

/* 额外：globalThis / exports 赋值 */
const reG = /(?:globalThis|exports)\.([A-Za-z_$][\w$]*)\s*=/g;
let gm;
while ((gm = reG.exec(srcCode))) addDef(gm[1], 'src', 0, 'global-export');

/* game.html 内联脚本中的定义（构建产物与 src 应一致，再扫一遍兜底） */
if (gameHtml) {
  const scriptBlocks = [];
  const reScript = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let sm;
  while ((sm = reScript.exec(gameHtml))) scriptBlocks.push(sm[1]);
  const builtCode = scriptBlocks.join('\n');
  let m2;
  const reFnB = /function\s+([A-Za-z_$][\w$]*)\s*\(/g;
  while ((m2 = reFnB.exec(builtCode))) addDef(m2[1], 'game.html', 0, 'built-function');
  const reAssignB = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\()/g;
  while ((m2 = reAssignB.exec(builtCode))) addDef(m2[1], 'game.html', 0, 'built-const-fn');
}

/* 内置/浏览器回调白名单（不是本项目定义，但合法） */
const BUILTIN = new Set([
  'alert', 'confirm', 'prompt', 'console', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
  'requestAnimationFrame', 'cancelAnimationFrame', 'fetch', 'open', 'close', 'focus', 'blur',
  'parseInt', 'parseFloat', 'isNaN', 'JSON', 'Math', 'Date', 'Object', 'Array', 'String', 'Number',
  'Boolean', 'RegExp', 'Error', 'Promise', 'Map', 'Set', 'Symbol', 'encodeURI', 'decodeURI',
  'encodeURIComponent', 'decodeURIComponent', 'escape', 'unescape',
]);

/* ---------- 2. 收集 onclick 引用 ---------- */
// onclick="fn(...)"  onclick='fn(...)'  onchange="fn(...)"  oninput=  onsubmit=  onkeydown=
const HANDLER_RE = /on(?:click|change|input|submit|keydown|keyup|mousedown|mouseup|mouseenter|mouseleave|dblclick|contextmenu)\s*=\s*(["'])([\s\S]*?)\1/gi;
// 也扫 JS 模板里的 onclick="..." 字符串（ui*.js 里大量这样写）
const refs = []; // {fn, source, file, line, snippet}

function extractFnsFromHandler(expr, source, file, line) {
  // 可能多个语句: fn(a);fn2() 或 return false;go()
  // 抽取所有 Identifier( 调用
  const callRe = /(?:^|[;,&|?:!+\-*/%<>=()\s{}])([A-Za-z_$][\w$]*)\s*\(/g;
  let m;
  while ((m = callRe.exec(expr))) {
    const fn = m[1];
    if (BUILTIN.has(fn)) continue;
    if (['return', 'if', 'for', 'while', 'switch', 'typeof', 'new', 'function', 'var', 'let', 'const', 'else', 'do', 'try', 'catch', 'throw', 'delete', 'void', 'in', 'of', 'instanceof', 'this', 'true', 'false', 'null', 'undefined'].includes(fn)) continue;
    refs.push({ fn, source, file, line, snippet: expr.trim().slice(0, 160) });
  }
}

function scanOnclickInText(text, file) {
  const lines = text.split(/\r?\n/);
  // 也做全文扫描以捕获跨行属性（少见）
  let m;
  const re = new RegExp(HANDLER_RE.source, 'gi');
  while ((m = re.exec(text))) {
    const before = text.slice(0, m.index);
    const line = before.split(/\r?\n/).length;
    extractFnsFromHandler(m[2], 'attr', file, line);
  }
  // 行内补充：document.write / innerHTML 字符串
  lines.forEach((ln, i) => {
    if (!/on(?:click|change|input|submit)/i.test(ln)) return;
    const re2 = /on(?:click|change|input|submit|keydown)\s*=\s*(["'])([^"']*)\1/gi;
    let m2;
    while ((m2 = re2.exec(ln))) extractFnsFromHandler(m2[2], 'attr-line', file, i + 1);
    // JS 里 onclick: 'fn()' 形式（少见）
    const re3 = /onclick\s*:\s*(["'])([^"']*)\1/gi;
    while ((m2 = re3.exec(ln))) extractFnsFromHandler(m2[2], 'prop', file, i + 1);
    // addEventListener('click', foo) / addEventListener("click", function
    const re4 = /addEventListener\s*\(\s*["'](?:click|change|input)["']\s*,\s*([A-Za-z_$][\w$]*)/g;
    while ((m2 = re4.exec(ln))) {
      refs.push({ fn: m2[1], source: 'addEventListener', file, line: i + 1, snippet: ln.trim().slice(0, 160) });
    }
  });
}

files.forEach(f => scanOnclickInText(f.text, f.name));
scanOnclickInText(srcHtml, 'src/index.html');
if (gameHtml) scanOnclickInText(gameHtml, 'game.html');

/* ---------- 3. 校验 ---------- */
const missing = [];
const caseMismatch = [];
const ok = [];
const seen = new Map(); // fn -> first ref

refs.forEach(r => {
  if (seen.has(r.fn)) {
    // 重复引用同一 fn，仍检查
  } else {
    seen.set(r.fn, r);
  }
  if (defined.has(r.fn)) {
    ok.push(r);
    return;
  }
  // 大小写不一致
  const lower = r.fn.toLowerCase();
  const hit = [...defined.keys()].find(d => d.toLowerCase() === lower && d !== r.fn);
  if (hit) {
    caseMismatch.push({ ...r, actual: hit, defAt: defined.get(hit) });
    return;
  }
  // 已删除函数启发式：定义表里有相似名（编辑距离 1-2 或前缀）
  const similar = [...defined.keys()].filter(d => {
    if (d === r.fn) return false;
    if (d.toLowerCase().startsWith(r.fn.toLowerCase().slice(0, 4)) && Math.abs(d.length - r.fn.length) <= 3) return true;
    if (r.fn.toLowerCase().startsWith(d.toLowerCase().slice(0, 4)) && Math.abs(d.length - r.fn.length) <= 3) return true;
    // levenshtein ≤2 for len>=5
    if (Math.abs(d.length - r.fn.length) <= 2 && d.length >= 5) {
      let i = 0, j = 0, diff = 0;
      // simple: count char mismatches by set
      const setA = new Set(d.toLowerCase());
      const setB = new Set(r.fn.toLowerCase());
      let inter = 0;
      setA.forEach(c => { if (setB.has(c)) inter++; });
      const union = setA.size + setB.size - inter;
      if (union && inter / union >= 0.7) return true;
    }
    return false;
  }).slice(0, 5);
  missing.push({ ...r, similar });
});

/* 重复函数定义（同名多次 → 后者覆盖，onclick 可能绑到旧语义） */
const dupDefs = [];
const fnCount = new Map();
files.forEach(f => {
  const re = /function\s+([A-Za-z_$][\w$]*)\s*\(/g;
  let m;
  while ((m = re.exec(f.text))) {
    if (!fnCount.has(m[1])) fnCount.set(m[1], []);
    const before = f.text.slice(0, m.index);
    fnCount.get(m[1]).push({ file: f.name, line: before.split(/\r?\n/).length });
  }
});
fnCount.forEach((locs, name) => {
  if (locs.length > 1) dupDefs.push({ fn: name, locs });
});

/* game.html vs src 定义差分：正式版若缺模块，onclick 会 404 */
const srcDefined = new Set();
files.forEach(f => {
  const re = /function\s+([A-Za-z_$][\w$]*)\s*\(/g;
  let m;
  while ((m = re.exec(f.text))) srcDefined.add(m[1]);
});
const builtOnly = [];
const srcOnlyMissingInBuilt = [];
if (gameHtml) {
  const builtFns = new Set();
  const reScript = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let sm;
  const reFn = /function\s+([A-Za-z_$][\w$]*)\s*\(/g;
  while ((sm = reScript.exec(gameHtml))) {
    let m2;
    reFn.lastIndex = 0;
    while ((m2 = reFn.exec(sm[1]))) builtFns.add(m2[1]);
  }
  // src 引用的 fn 若只在 src 有而 game.html 没有 → 正式版失效
  refs.forEach(r => {
    if (r.file !== 'game.html' && srcDefined.has(r.fn) && !builtFns.has(r.fn) && !BUILTIN.has(r.fn)) {
      srcOnlyMissingInBuilt.push({ fn: r.fn, refFile: r.file, refLine: r.line });
    }
  });
  builtFns.forEach(fn => { if (!srcDefined.has(fn)) builtOnly.push(fn); });
}

/* game.html 内 onclick 未定义（正式版真实风险） */
const gameMissing = missing.filter(x => x.file === 'game.html');
const srcMissing = missing.filter(x => x.file !== 'game.html');

/* 去重 missing by fn */
function dedupByFn(arr) {
  const m = new Map();
  arr.forEach(x => {
    if (!m.has(x.fn)) m.set(x.fn, { ...x, occurrences: [] });
    m.get(x.fn).occurrences.push({ file: x.file, line: x.line, snippet: x.snippet, source: x.source });
  });
  return [...m.values()];
}

const report = {
  meta: {
    scannedFiles: files.map(f => f.name).concat(['src/index.html', gameHtml ? 'game.html' : null]).filter(Boolean),
    totalDefined: defined.size,
    totalRefs: refs.length,
    uniqueRefs: seen.size,
  },
  missing: dedupByFn(missing),
  missingGameHtml: dedupByFn(gameMissing),
  missingSrc: dedupByFn(srcMissing),
  caseMismatch: dedupByFn(caseMismatch),
  dupDefs,
  srcOnlyMissingInBuilt: dedupByFn(srcOnlyMissingInBuilt),
  builtOnlySample: builtOnly.slice(0, 20),
  okCount: ok.length,
};

const outPath = path.join(__dirname, 'onclick-audit-result.json');
fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');

console.log('=== onclick 静态完整性 ===');
console.log('定义函数:', report.meta.totalDefined, ' 引用次数:', report.meta.totalRefs, ' 唯一回调:', report.meta.uniqueRefs);
console.log('未定义回调:', report.missing.length, report.missing.map(x => x.fn + (x.similar && x.similar.length ? ' ~' + x.similar.join('/') : '')).join(', ') || '(无)');
console.log('大小写不一致:', report.caseMismatch.length, report.caseMismatch.map(x => x.fn + '→' + x.actual).join(', ') || '(无)');
console.log('重复函数定义:', report.dupDefs.length, report.dupDefs.map(x => x.fn + '×' + x.locs.length).join(', ') || '(无)');
console.log('src 引用但 game.html 缺失:', report.srcOnlyMissingInBuilt.length, report.srcOnlyMissingInBuilt.map(x => x.fn).join(', ') || '(无)');
console.log('game.html 未定义回调:', report.missingGameHtml.length, report.missingGameHtml.map(x => x.fn).join(', ') || '(无)');
console.log('详细:', outPath);

if (report.missing.length || report.caseMismatch.length || report.srcOnlyMissingInBuilt.length) {
  process.exitCode = 2;
}
