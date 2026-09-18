/* 全量体检探针：用真实存档实测「渲染量 / 加载耗时 / 存储读写 / 查找规模 / 存档构成」
   运行：node tests/dev/audit-perf.js [存档json路径]
   只读产品代码，不改任何状态以外的东西；结论供 OPTIMIZE-AUDIT 复检用。
   注意：harness 的 DOM 桩把 innerHTML 当字符串，所以「节点数」按标签开括号估算，
   与真实 DOM 有偏差，但**跨页面/跨版本比较的口径一致**。 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { makeDom, FILES } = require('../harness');

const SAVE = process.argv[2] || path.join(__dirname, '..', '..', 'saves', 'KPL存档_AG_2026年_槽1.json');
const raw = (() => {
  const txt = fs.readFileSync(SAVE, 'utf8');
  const j = JSON.parse(txt);
  return (j.kplSave && j.data) ? JSON.stringify(j.data) : txt;  // 文件包装格式 → 裸存档
})();

const t0 = Date.now();
const { dom, elCache } = makeDom();
const loadMs = Date.now() - t0;
console.log(`模块求值：${loadMs} ms（${FILES.length} 个模块）`);

// —— 存储访问计数（包住 localStorage，模块每次调用都走全局属性查找，替换即生效）
let g = 0, st = 0;
const writes = {}, reads = {};
const inner = dom.localStorage;
dom.localStorage = {
  getItem: k => { g++; reads[k] = (reads[k] || 0) + 1; return inner.getItem(k); },
  setItem: (k, v) => { st++; writes[k] = (writes[k] || 0) + 1; inner.setItem(k, v); },
  removeItem: k => inner.removeItem(k),
};
let wbase = {};   // 每页写按键基线，用于定位「谁在切页时写盘」

// —— 装载真实存档
dom.localStorage.setItem('esport_manager_save_v3', raw);
/* 计时口径警告：首次执行 load() 含 V8 冷编译，实测 48 ms → 热身第 2、3 次只有 8 / 5 ms。
   上一轮审计里「读档 100–250 ms 手机白屏」和「0.25 ms」两个结论都不成立，
   因为谁都没区分冷启动与热路径。这里先热身 6 次再取 15 次的中位数。 */
for (let i = 0; i < 6; i++) vm.runInContext('load()', dom);

// —— 函数调用计数 + Array.prototype.find 规模计数
vm.runInContext(`
this.__c = {};
this.__find = { n: 0, cells: 0, max: 0 };
(function () {
  const of = Array.prototype.find;
  Array.prototype.find = function (fn, thisArg) {
    if (this && this.length) { __find.n++; __find.cells += this.length; if (this.length > __find.max) __find.max = this.length; }
    return of.call(this, fn, thisArg);
  };
  ['teamPower', 'weeklyWage', 'allStarTeams', 'defOf', 'genMatchStory', 'playerStatus'].forEach(function (fn) {
    if (typeof globalThis[fn] === 'function') {
      const o = globalThis[fn];
      globalThis[fn] = function () { __c[fn] = (__c[fn] || 0) + 1; return o.apply(this, arguments); };
    }
  });
})();
`, dom);

const times = [];
for (let i = 0; i < 15; i++) { const t = process.hrtime.bigint(); vm.runInContext('load()', dom); times.push(Number(process.hrtime.bigint() - t) / 1e6); }
times.sort((a, b) => a - b);
console.log(`读档 + migrateSave（热身后 15 次）：中位 ${times[7].toFixed(1)} ms · min ${times[0].toFixed(1)} · max ${times[14].toFixed(1)}`);
vm.runInContext('load()', dom);

const S = vm.runInContext('S', dom);
console.log(`档：${S.teamName} · 第 ${S.season} 季 ${S.split} · phase=${S.phase} · 名单 ${S.players.length} 人 · 资金 ${S.fund}`);

const snapshot = () => {
  const out = {};
  for (const sel in elCache) out[sel] = elCache[sel].innerHTML ? elCache[sel].innerHTML.length : 0;
  return out;
};
const deltaHtml = (before, sel) => (elCache[sel] ? (elCache[sel].innerHTML || '').length - (before[sel] || 0) : 0);

// —— 逐页渲染
const PAGES = ['club', 'lineup', 'market', 'train', 'league', 'kjia', 'career', 'union', 'hall', 'biz'];
console.log('\n页面          耗时ms   输出KB   标签数    存储读/写    容器');
let sweep = { ms: 0, kb: 0 };
g = 0; st = 0;                       // 计数只统计「切页」这一段，不含上面 22 次计时用的 load
wbase = Object.assign({}, writes);
PAGES.forEach(p => {
  const b = snapshot();
  const r0 = g, w0 = st;
  const t = Date.now();
  vm.runInContext(`renderPage(${JSON.stringify(p)})`, dom);
  const ms = Date.now() - t;
  let html = 0, tags = 0, where = '';
  for (const sel in elCache) {
    const d = deltaHtml(b, sel);
    if (d > 200) { html += (elCache[sel].innerHTML || '').length; tags += ((elCache[sel].innerHTML || '').match(/</g) || []).length; where = sel; }
  }
  sweep.ms += ms; sweep.kb += html / 1024;
  const wkeys = Object.keys(writes).filter(k => writes[k] > (wbase[k] || 0)).map(k => k.replace('esport_manager_save_v3', 'SAVE').replace('_auto', '+auto')).join(',');
  wbase = Object.assign({}, writes);
  console.log(`${p.padEnd(12)} ${String(ms).padStart(6)} ${(html / 1024).toFixed(1).padStart(8)} ${String(tags).padStart(8)}    ${g - r0}/${st - w0} ${wkeys.padEnd(18)} ${where}`);
});
console.log(`${'合计'.padEnd(11)} ${String(sweep.ms).padStart(6)} ${sweep.kb.toFixed(1).padStart(8)}    （10 页一次遍历）`);
console.log(`切页期 localStorage：读 ${g} 次 · 写 ${st} 次`);
console.log('  写按键：', JSON.stringify(writes), '\n  读按键：', JSON.stringify(reads));
console.log('热点函数调用次数：', JSON.stringify(vm.runInContext('__c', dom)));
const f = vm.runInContext('__find', dom);
console.log(`Array.find：${f.n} 次调用 · 累计扫描 ${f.cells} 个元素 · 最长数组 ${f.max}`);

// —— 最大页面（转会市场）结构拆解：找出重复块
const mkHtml = elCache['#page-market'] ? elCache['#page-market'].innerHTML : '';
if (mkHtml) {
  const blocks = {};
  (mkHtml.match(/<div class="([a-z][a-z0-9_-]{2,20})"/gi) || []).forEach(m => {
    const c = m.replace(/<div class="/, '').replace(/"$/, '');
    blocks[c] = (blocks[c] || 0) + 1;
  });
  const top = Object.entries(blocks).sort((a, b) => b[1] - a[1]).slice(0, 8);
  console.log(`\n#page-market 共 ${(mkHtml.length / 1024).toFixed(1)} KB，class 出现次数 top8：`);
  top.forEach(([c, n]) => console.log(`  ${String(n).padStart(5)} × .${c}`));
  const lists = vm.runInContext('[S.market.length, (S.transferList||[]).length, (S.freeAgents||[]).length, (S.players||[]).length, (S.extraDefs||[]).length]', dom);
  console.log(`  数据规模：market ${lists[0]} · transferList ${lists[1]} · freeAgents ${lists[2]} · 名单 ${lists[3]} · extraDefs ${lists[4]}`);
}

// —— 存档体积构成
const ser = vm.runInContext('serializeForSave(S)', dom);
const obj = JSON.parse(ser);
const parts = Object.keys(obj).map(k => [k, JSON.stringify(obj[k]).length]).sort((a, b) => b[1] - a[1]);
const tot = parts.reduce((a, x) => a + x[1], 0);
console.log(`\n落盘字符串：${ser.length} 字符（落盘字段 ${parts.length} 个）`);
parts.slice(0, 8).forEach(([k, v]) => console.log(`  ${String(v).padStart(6)}  ${(100 * v / tot).toFixed(1).padStart(5)}%  ${k}`));

// —— 重复字符串可字典化的字段（旧审计未覆盖的角度）
function dictStat(list, key) {
  if (!Array.isArray(list) || !list.length) return null;
  const m = new Map();
  list.forEach(e => { const s = String(JSON.stringify(e && e[key])); m.set(s, (m.get(s) || 0) + 1); });
  let waste = 0; m.forEach((cnt, k) => { if (cnt > 1) waste += (cnt - 1) * k.length; });
  return { total: list.length, uniq: m.size, waste };
}
['extraDefs', 'retiredDefs'].forEach(k => {
  const s = dictStat(obj[k], 'skill');
  if (s && s.waste) console.log(`${k}.skill：${s.total} 条 / ${s.uniq} 种 → 重复 ${s.waste} 字符可字典化`);
  const c = dictStat(obj[k], 'career');
  if (c && c.waste) console.log(`${k}.career：${c.total} 条 / ${c.uniq} 种 → 重复 ${c.waste} 字符可字典化`);
});
const hist = obj.history || [];
let hTot = 0, hLogs = 0;
hist.forEach(x => { hTot += JSON.stringify(x).length; hLogs += JSON.stringify(x.logs || []).length; });
if (hTot) console.log(`history.logs：${hLogs} / ${hTot} 字符（${(100 * hLogs / hTot).toFixed(1)}%），共 ${hist.length} 场`);
console.log(`\n体积变化：读入 ${raw.length} 字符 → 读档+迁移后落盘 ${ser.length} 字符（${ser.length > raw.length ? '+' : ''}${(100 * (ser.length - raw.length) / raw.length).toFixed(1)}%）`);
const added = parts.filter(([k]) => !Object.keys(JSON.parse(raw)).includes(k)).map(([k, v]) => `${k} ${v}`).join(' · ');
if (added) console.log('读档新增落盘字段：', added);

// —— 膨胀是否单调：把「落盘 → 读档 → 再落盘」跑 5 轮
console.log('\n读盘/落盘往返（每轮 = 写入 → load() → serializeForSave）：');
let cur = ser, prev = null;
for (let i = 0; i < 5; i++) {
  dom.localStorage.setItem('esport_manager_save_v3', cur);
  vm.runInContext('load()', dom);
  prev = cur.length;
  cur = vm.runInContext('serializeForSave(S)', dom);
  console.log(`  第 ${i + 1} 轮：${prev} → ${cur.length} 字符（${cur.length >= prev ? '+' : ''}${cur.length - prev}）`);
}
const o2 = JSON.parse(cur);
['eventLog', 'history', 'draft', 'extraDefs', 'academy'].forEach(k => {
  const a = obj[k], b = o2[k];
  const n = v => Array.isArray(v) ? v.length : (v && typeof v === 'object' ? Object.keys(v).length : v);
  if (JSON.stringify(a) !== JSON.stringify(b)) console.log(`  往返后 ${k} 变了：${n(a)} → ${n(b)}`);
});
