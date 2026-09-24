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

function loadCode() {
  let code = '';
  FILES.forEach(f => { code += fs.readFileSync(path.join(ROOT, 'src', 'js', f), 'utf8') + '\n'; });
  return code;
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
    select() {}, querySelector() { return null; }, querySelectorAll() { return []; },
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
  const code = (opts && opts.code != null) ? opts.code : loadCode();
  vm.runInContext(code, dom);
  injectHelpers(dom);
  return { dom, elCache };
}

// 断言工具：失败记入 errors，全部跑完再汇总（每个用例可独立失败）
function makeTester(name) {
  const errors = [];
  return {
    check(cond, msg) { if (!cond) errors.push(msg); },
    get errors() { return errors; },
    report() {
      if (errors.length) {
        console.log('[FAIL] ' + name + ':\n  ' + errors.join('\n  '));
        process.exitCode = 1;
        return false;
      }
      console.log('[PASS] ' + name);
      return true;
    },
  };
}

module.exports = { makeDom, makeTester, loadCode, injectHelpers, FILES };
