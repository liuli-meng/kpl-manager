// 年代赛制时间线回归：yearFmt 随 2016→2026 切换结构/BO/全局BP/年总
// 运行：node tests/verify-year-format.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
function load() {
  const files = [
    'src/js/data.js',
    'src/js/season.js',
  ];
  // season.js 依赖更多运行时；这里只求 yearFmt / KPL_YEAR_FORMAT / applyYearFmt
  const code = files.map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
  const sandbox = {
    console,
    Math,
    JSON,
    Object,
    Array,
    Number,
    String,
    parseInt,
    isNaN,
    Set,
    Map,
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    rnd: (a, b) => a,
    pick: (arr) => arr[0],
    toast: () => {},
    logEvent: () => {},
    save: () => {},
    renderAll: () => {},
    setPhase: () => {},
  };
  vm.createContext(sandbox);
  // 只提取 yearFmt 所需片段（避免拉进 ECON/SCENARIOS 等运行时）
  const start = code.indexOf('const KPL_FORMAT');
  const endFn = code.indexOf('function applyYearFmt');
  if (start < 0 || endFn < 0) throw new Error('cannot slice year format block');
  const snippet =
    code.slice(start, endFn) +
    '\nthis.yearFmt=yearFmt; this.KPL_YEAR_FORMAT=KPL_YEAR_FORMAT; this.KPL_FORMAT=KPL_FORMAT;';
  vm.runInContext(snippet, sandbox);
  return sandbox;
}

let failed = 0;
function ok(m) { console.log('[PASS]', m); }
function fail(m) { console.log('[FAIL]', m); failed++; }

const g = load();
const yf = g.yearFmt;

const cases = [
  [2016, { structure: 'ab', globalBp: false, hasAnnual: false, playoffBo: 5, hasCard: false }],
  [2017, { structure: 'double-rr', globalBp: false, regBo: 3, hasAnnual: false, hasCard: false }],
  [2018, { structure: 'eastwest', globalBp: false, promo: true, hasCard: false }],
  [2019, { structure: 'eastwest', globalBp: true, hasAnnual: false, promo: false }],
  [2020, { structure: 'single', globalBp: true, hasAnnual: false }],
  [2021, { structure: 'sab', hasCard: true, globalBp: true, hasAnnual: false }],
  [2024, { structure: 'sab', hasAnnual: true, hasCard: true }],
  [2026, { structure: 'sab', cardBo: 5, hasAnnual: true, globalBp: true }],
];

for (const [y, want] of cases) {
  const f = yf(y);
  const bad = Object.keys(want).filter((k) => f[k] !== want[k]);
  if (bad.length) fail(y + ' ' + bad.map((k) => k + '=' + f[k] + ' want ' + want[k]).join(', '));
  else ok(y + ' ' + JSON.stringify(want));
}

// 时间线单调性：全局 BP 在 2019 起为 true，此前为 false
for (let y = 2016; y <= 2026; y++) {
  const f = yf(y);
  const expectGbp = y >= 2019;
  if (f.globalBp !== expectGbp) fail(y + ' globalBp=' + f.globalBp + ' 应为 ' + expectGbp);
  const expectAnnual = y >= 2024;
  if (f.hasAnnual !== expectAnnual) fail(y + ' hasAnnual=' + f.hasAnnual + ' 应为 ' + expectAnnual);
}
ok('时间线：2019 起全局 BP · 2024 起年总');

// 表外年份回落
if (yf(2030).structure !== 'sab') fail('2030 应回落 2026 sab');
else ok('2030 回落 2026 口径');
if (yf(2015).structure !== 'ab') fail('2015 应回落 2016 ab');
else ok('2015 回落 2016 口径');

console.log(failed ? '[FAIL] verify-year-format ×' + failed : '[PASS] verify-year-format');
if (failed) process.exitCode = 1;
