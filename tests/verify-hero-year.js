// 英雄池按上线年解锁：2016 打不出姬小满/镜；2026 全开
// 运行：node tests/verify-hero-year.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const code = fs.readFileSync(path.join(ROOT, 'src/js/data.js'), 'utf8');
const start = code.indexOf('const HEROES=');
const end = code.indexOf('/* ================= 选手池');
if (start < 0 || end < 0) throw new Error('cannot slice HEROES block');

const sandbox = {
  console, Math, JSON, Object, Array, Number, String, parseInt, isNaN, Set, Map,
  gameYear: (s) => (s && s._y) || 2026,
};
vm.createContext(sandbox);
vm.runInContext(code.slice(start, end) + `
this.HEROES=HEROES; this.heroesForYear=heroesForYear; this.HERO_RELEASE=HERO_RELEASE;
this.heroesOf=heroesOf; this.heroesNow=heroesNow; this.HERO_BY_NAME=HERO_BY_NAME;
`, sandbox);

let failed = 0;
const ok = (m) => console.log('[PASS]', m);
const fail = (m) => { console.log('[FAIL]', m); failed++; };

const POS = ['top', 'jg', 'mid', 'ad', 'sup'];
function countPos(list) {
  const c = { top: 0, jg: 0, mid: 0, ad: 0, sup: 0 };
  list.forEach((h) => (h.pos || []).forEach((p) => { if (c[p] != null) c[p]++; }));
  return c;
}

// 2015/2016 开服批不应含后期英雄
const y16 = sandbox.heroesForYear(2016);
const names16 = new Set(y16.map((h) => h.n));
for (const n of ['姬小满', '镜', '澜', '大司命', '海月', '戈娅', '莱西奥', '亚连', '司空震']) {
  if (names16.has(n)) fail('2016 池不应含 ' + n);
}
ok('2016 池排除后期英雄（姬小满/镜/大司命…）· 共 ' + y16.length);

// 2017 应含干将/鬼谷子，仍无镜
const y17 = sandbox.heroesForYear(2017);
const names17 = new Set(y17.map((h) => h.n));
if (!names17.has('干将莫邪') || !names17.has('鬼谷子')) fail('2017 应含干将莫邪/鬼谷子');
else ok('2017 含干将/鬼谷子');
if (names17.has('镜')) fail('2017 不应含镜');
else ok('2017 仍无镜');

// 2020 应含镜/澜/蒙恬
const y20 = sandbox.heroesForYear(2020);
const names20 = new Set(y20.map((h) => h.n));
for (const n of ['镜', '澜', '蒙恬']) {
  if (!names20.has(n)) fail('2020 应含 ' + n);
}
ok('2020 含镜/澜/蒙恬');

// 2026 全开
if (sandbox.heroesForYear(2026).length !== sandbox.HEROES.length) fail('2026 应全开');
else ok('2026 全开 · ' + sandbox.HEROES.length + ' 英雄');

// 各位置保底：2016 每位置 ≥5（够 BO5 征召）
const c16 = countPos(y16);
for (const p of POS) {
  if (c16[p] < 5) fail('2016 ' + p + ' 仅 ' + c16[p] + ' 英雄，不足 BO5');
}
ok('2016 各位置 ≥5：' + JSON.stringify(c16));

// 上线年字段齐全
const missing = sandbox.HEROES.filter((h) => !h.y);
if (missing.length) fail('缺上线年：' + missing.map((h) => h.n).join(','));
else ok('全部英雄已标注上线年');

// 与公开时间线对齐的锚点（百科/爆料站/荣耀助手汇总）
const anchors = {
  后羿: 2015, 貂蝉: 2015, 吕布: 2015, 廉颇: 2015, 韩信: 2015, 露娜: 2015,
  花木兰: 2016, 张飞: 2016, 李白: 2016, 李元芳: 2016, 刘邦: 2016, 娜可露露: 2016, 兰陵王: 2016,
  干将莫邪: 2017, 鬼谷子: 2017, 大乔: 2016, 东皇太一: 2017, 黄忠: 2017,
  公孙离: 2018, 裴擒虎: 2018, 狂铁: 2018, 上官婉儿: 2018, 盾山: 2018,
  猪八戒: 2019, 西施: 2019, 马超: 2019, 嫦娥: 2019,
  镜: 2020, 蒙恬: 2020, 阿古朵: 2020, 夏洛特: 2020, 澜: 2020, 蒙犽: 2020,
  司空震: 2021, 云缨: 2021, 金蝉: 2021,
  桑启: 2022, 戈娅: 2022, 海月: 2022,
  莱西奥: 2023, 姬小满: 2023, 亚连: 2023,
  大司命: 2024,
};
let badAnchor = 0;
for (const [n, y] of Object.entries(anchors)) {
  const got = (sandbox.HERO_BY_NAME[n] || {}).y;
  if (got !== y) { fail(n + ' 上线年 ' + got + ' 应为 ' + y); badAnchor++; }
}
if (!badAnchor) ok('时间线锚点 ' + Object.keys(anchors).length + ' 项对齐公开资料');

// heroesNow 跟 S._y
sandbox.S = { _y: 2016 };
const now16 = sandbox.heroesNow().length;
if (now16 !== y16.length) fail('heroesNow(2016)=' + now16 + ' 应等于 heroesForYear(2016)');
else ok('heroesNow 跟随存档年');
sandbox.S = { _y: 2026 };

console.log(failed ? '[FAIL] verify-hero-year ×' + failed : '[PASS] verify-hero-year');
if (failed) process.exitCode = 1;
