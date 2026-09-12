// 共享测试基座：把 src/js 模块拼进 vm 沙箱（浏览器 DOM/localStorage 全桩）
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const FILES = ['data.js','state.js','players.js','transfer.js','train.js','season.js','natcamp.js','board.js','clubops.js','kjia.js','cups.js','career.js','bp.js','match.js','ui.js','main.js'];

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

function makeDom() {
  const el = () => ({
    classList: { add() {}, remove() {}, toggle() {} }, style: {}, innerHTML: '', value: '',
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
  vm.createContext(dom);
  vm.runInContext(loadCode(), dom);
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
