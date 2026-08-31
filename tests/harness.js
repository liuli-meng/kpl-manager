// 共享测试基座：把 src/js 模块拼进 vm 沙箱（浏览器 DOM/localStorage 全桩）
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const FILES = ['data.js','state.js','players.js','transfer.js','train.js','season.js','bp.js','match.js','ui.js','main.js'];

function loadCode() {
  let code = '';
  FILES.forEach(f => { code += fs.readFileSync(path.join(ROOT, 'src', 'js', f), 'utf8') + '\n'; });
  return code;
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
    localStorage: { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; } },
    document: {
      querySelector: sel => cachedEl(sel), querySelectorAll: () => [], createElement: () => el(),
      execCommand: () => {}, body: el(), addEventListener() {}, removeEventListener() {},
    },
    window: null, confirm: () => true, alert() {}, toast() {}, location: { reload() {} },
    setTimeout: () => 0, clearTimeout() {},
  };
  dom.window = dom;
  vm.createContext(dom);
  vm.runInContext(loadCode(), dom);
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

module.exports = { makeDom, makeTester };
