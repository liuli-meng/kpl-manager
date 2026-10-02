// 共享测试基座：把 src/js 模块拼进 vm 沙箱（浏览器 DOM/localStorage 全桩）
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
/* 模块清单单一真相源：直接解析 src/index.html 的 <script src> 顺序（build.ps1 读的是同一份）。
   以前这里手抄一份，新增模块漏改任一处 → 构建产物缺模块、或测试压根没加载该模块，
   只能靠 verify-built 事后抓（draft.js 就被抓过一次）。现在两份清单不可能再分叉。
   解析失败必须抛错：静默退化成空列表会让所有测试「空跑通过」，比漏模块更危险。 */
function readModuleList() {
  const html = fs.readFileSync(path.join(ROOT, 'src', 'index.html'), 'utf8');
  const out = [];
  const re = /<script\s+src="js\/([^"]+)"\s*>\s*<\/script>/g;
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  if (out.length < 10) throw new Error('harness: 从 src/index.html 只解析到 ' + out.length + ' 个模块，正则疑似失配——拒绝空跑');
  return out;
}
const FILES = readModuleList();

/* 拼接文本：**只给需要扫源码文本的用例用**（audit-static 的正则扫描）。
   不要再拿它去 runInContext —— 见 loadModules 的说明。 */
function loadCode() {
  let code = '';
  FILES.forEach(f => { code += fs.readFileSync(path.join(ROOT, 'src', 'js', f), 'utf8') + '\n'; });
  return code;
}

/* 逐模块加载：与浏览器 <script> 语义对齐（每个模块 = 独立的 Script 记录）。
   为什么必须这样（2026-10-02 用真实 Chrome 实测的两条语义）：
   ① 后置模块的顶层 const 对前面的模块是「尚未声明」——前面模块里 `typeof X` 得到 'undefined'，
      不抛错；而把 40 个模块拼成一个脚本后，同一个表达式命中 TDZ 抛 ReferenceError。
      真实代价：data.js 的 ensureYearEras 静默失败 → 沙箱里 KPL_ERAS 只剩 2/11 个时代档，
      浏览器里 11 个全在。门禁因此长期只验证 2/11 个时代档，而且会让人误报线上缺陷。
   ② 两个模块各自顶层声明同名 const/let：浏览器里**第二个 script 整块报错不执行**
      （Identifier 'X' has already been declared），拼成一个脚本则整个沙箱起不来。
      这一条由 audit-static ②b 静态拦下（生产里它等于一整个模块静默失效）。 */
function loadModules(dom) {
  FILES.forEach(f => {
    const src = fs.readFileSync(path.join(ROOT, 'src', 'js', f), 'utf8');
    vm.runInContext(src, dom, { filename: 'src/js/' + f });
  });
  return dom;
}

/* 逐个执行一段段脚本源码：制造/校验多 <script> 语义时用。
   默认**把错误抛出去**（模块加载失败必须让门禁当场报红，不能静默）；
   opts.continueOnError=true 时改为「记下错误继续跑下一个脚本」——那是浏览器对
   独立 <script> 的真实行为（一个 script 抛错不影响其它 script），
   verify-harness-fidelity 用它来钉语义。返回收集到的错误数组。 */
function runScripts(dom, scripts, opts) {
  const errs = [];
  scripts.forEach((s, i) => {
    try {
      vm.runInContext(s, dom, { filename: '<script#' + (i + 1) + '>' });
    } catch (e) {
      if (!(opts && opts.continueOnError)) throw e;
      errs.push(e);
    }
  });
  return errs;
}

// 沙箱内辅助：组一支 5 人首发（位置齐全，返回 S）。
// usedNames 必须跨位置共享 —— 旧用例各位置各 new Set()，5 个位置全挑到同一个名字（满队「弈秋」）。
// band 决定四维基准（star/mid/low），starBand 单独指定 1 号位的档位（默认同 band）。
const HELPERS = `
this.fillRoster=function(S,band,starBand){
  const b=band||'mid',sb=starBand||b,u=new Set();
  POS_ORDER.forEach((pos,i)=>S.players.push(genPlayer(genFreeAgentDef(pos,i===0?sb:b,u))));
  S.lineup=S.players.map(p=>p.id);
  return S;
};
`;

/* 自带 vm 上下文的测试（如 sim-quick.js）可注入同一套辅助，避免各自复制一份 */
function injectHelpers(dom) {
  vm.runInContext(HELPERS, dom);
  return dom;
}

// opts.code：可选，改跑自定义脚本源（默认 src/js 拼接）；verify-built 用它加载 game.html 内联脚本
function makeDom(opts) {
  const el = () => ({
    classList: (function(){ const s=new Set(); return {
      add(c){ if(c) s.add(c); },
      remove(c){ s.delete(c); },
      toggle(c){ if(s.has(c)) s.delete(c); else if(c) s.add(c); },
      contains(c){ return s.has(c); },
      toString(){ return Array.from(s).join(' '); },
    }; })(), style: {}, innerHTML: '', value: '',
    textContent: '', dataset: {}, disabled: false, addEventListener() {}, appendChild() {},
    select() {}, setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
  });
  const elCache = {};
  const cachedEl = sel => elCache[sel] || (elCache[sel] = el());
  const store = {};
  const dom = {
    getElementById: id => cachedEl('#' + id),
    querySelector: sel => cachedEl(sel),
    querySelectorAll: () => [],
    addEventListener() {}, removeEventListener() {},
    localStorage: { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; } },
    document: {
      // getElementById 必须提供：src 里有多处按 id 取元素（队徽生成器、开局剧本按钮等），
      // 桩缺了它会让"加载期就会跑到的 UI 代码"把整个沙箱打爆（模拟器尤其容易被静默搞挂）
      getElementById: id => cachedEl('#' + id),
      querySelector: sel => cachedEl(sel), querySelectorAll: () => [], createElement: () => el(),
      execCommand: () => {}, body: el(), addEventListener() {}, removeEventListener() {},
    },
    window: null, confirm: () => true, alert() {}, toast() {}, location: { reload() {} },
    setTimeout: () => 0, clearTimeout() {},
    requestAnimationFrame: () => 0, cancelAnimationFrame: () => 0,
    performance: { now: () => Date.now() },
  };
  dom.window = dom;
  // 无头门禁：结算弹窗无人点「继续」，季后/杯赛挂起推进会卡死——沙箱内自动 flush
  dom.kmAutoAdvance = true;
  vm.createContext(dom);
  /* 加载策略（优先级从高到低）：
     opts.code    显式单脚本（历史用法，不保证浏览器语义；仅在确实需要「一段拼接源码」时用）
     opts.scripts 脚本数组，逐个执行 —— 与浏览器 <script> 一致（verify-built 走这条）
     opts.prepend 前置桩脚本，之后逐模块加载（verify-storage-fallback 的「存储被禁」桩）
     默认          逐模块加载 loadModules() —— 与浏览器语义一致，新用例一律走这条 */
  if (opts && opts.code != null) {
    vm.runInContext(opts.code, dom);
  } else if (opts && Array.isArray(opts.scripts)) {
    runScripts(dom, opts.scripts);
  } else {
    if (opts && opts.prepend) vm.runInContext(opts.prepend, dom, { filename: '<prepend>' });
    loadModules(dom);
  }
  injectHelpers(dom);
  return { dom, elCache };
}

// 种子化沙箱随机（mulberry32）：与 sim-quick/fuzz 内联的那份同一实现，这里给需要
// "整轮可复现"的探针/门禁当共用出口——固定种子 ⇒ 同代码必得同一条轨迹，才能挂进 npm test
// 而不带来偶发红。Math 用 Object.create 包一层：round/imul/max 等原语照常可用。
function seedMath(dom, seed) {
  vm.runInContext('this.Math=(function(a){var f=function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};var M=Object.create(Math);M.random=f;return M;})(' + (seed | 0) + ')', dom);
  return dom;
}

// 断言工具：失败记入 errors，全部跑完再汇总（每个用例可独立失败）
function makeTester(name) {
  const errors = [];
  let checks = 0;
  return {
    check(cond, msg) { checks++; if (!cond) errors.push(msg); },
    ok(msg) { checks++; },
    fail(msg) { checks++; errors.push(msg); },
    get errors() { return errors; },
    get checks() { return checks; },
    report() {
      if (checks < 1) {
        console.log('[FAIL] ' + name + ' (0 checks):\n  门禁无任何有效断言（零断言违规）');
        process.exitCode = 1;
        return false;
      }
      if (errors.length) {
        console.log('[FAIL] ' + name + ' (' + (checks - errors.length) + '/' + checks + ' checks):\n  ' + errors.join('\n  '));
        process.exitCode = 1;
        return false;
      }
      console.log('[PASS] ' + name + ' (' + checks + '/' + checks + ' checks)');
      return true;
    },
  };
}

module.exports = { makeDom, makeTester, loadCode, loadModules, runScripts, injectHelpers, seedMath, FILES };
