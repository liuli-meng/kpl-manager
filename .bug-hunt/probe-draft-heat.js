/* 竞争热度：统计每签未放弃队数、成交价、参与队数 */
require('./harness-lite.js');
const { makeDom } = (() => {
  try { return require('../tests/harness.js'); } catch (e) {
    return { makeDom: () => ({ window: {}, S: {}, toast: () => {} }) };
  }
})();
// 直接用引擎（harness 内 load）
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// 复用 tests 的简易装载：直接 eval 源码太重，改调游戏函数——从 game.html 抽不现实。
// 用 verify-draft 的方式：node 内跑 engine。
const { execFileSync } = require('child_process');
const out = execFileSync(process.execPath, [path.join(__dirname, 'sim-draft-heat.js')], {
  encoding: 'utf8',
  cwd: path.join(__dirname, '..'),
  timeout: 30000,
});
console.log(out);
