/* 存储不可用（iOS Safari「阻止所有 Cookie」/ 无痕模式 / 配额写满）时的启动兜底门禁。
 历史故障形态：`state.js` 的 curSlot 是全仓第一个 localStorage 访问点，且在**模块顶层**——
 一旦读取抛异常，整个 state.js 当场中断，下面的 `let S=null` 永不执行，game.html 里后续
 内联模块全部 `S is not defined` → **整页白屏**，而且每次加载都崩在同一个点（用户表现为「永久打不开」）。
 现在读/写/删都走 storeGet/storeSet/storeDel（内存兜底），save() 失败降级 + 只提示一次。

 反向验证同样重要：正常环境里 storeSet 必须真的写进 localStorage、storeDel 必须真的删掉，
 否则「为了不崩」把存档功能整个改没了，门禁还全绿。 */
const vm = require('vm');
const { makeDom, loadCode, makeTester } = require('./harness');

const T = makeTester('存储不可用启动兜底');

/* ---------- ① 正常环境：功能不许被改没（反向验证） ---------- */
const ok = makeDom();
T.check(vm.runInContext('storeAvailable()', ok.dom) === true, '正常环境：storeAvailable() 应为 true');
T.check(vm.runInContext("storeSet('k1','v1')", ok.dom) === true, '正常环境：storeSet 应返回 true');
T.check(vm.runInContext("localStorage.getItem('k1')", ok.dom) === 'v1', '正常环境：值必须真的落进 localStorage');
T.check(vm.runInContext("storeGet('k1')", ok.dom) === 'v1', '正常环境：storeGet 应读回写入值');
vm.runInContext("storeDel('k1')", ok.dom);
T.check(vm.runInContext("localStorage.getItem('k1')", ok.dom) === null, '正常环境：storeDel 必须真的删掉');

/* ---------- ② 存储抛异常：把 localStorage 换成会抛的 getter，再加载全部模块 ---------- */
const blocked = makeDom({
  code: "Object.defineProperty(this,'localStorage',{configurable:true,get(){throw new Error('SecurityError: localStorage blocked');}});\n" + loadCode(),
});
const D = blocked.dom;

T.check(vm.runInContext('storeAvailable()', D) === false, '存储被禁：storeAvailable() 应为 false');
T.check(vm.runInContext('typeof S', D) === 'object', '存储被禁：S 必须已定义（state.js 没被中断）');
['goPage', 'newState', 'save', 'openSaveMgmt', 'restoreAutoBackup', 'setSlot', '_shareWrap', 'blobDLBlocked',
 'storeGet', 'storeSet', 'storeDel', 'storeWarnOnce'].forEach(fn => {
  T.check(vm.runInContext('typeof ' + fn, D) === 'function', '存储被禁：' + fn + ' 应已定义（说明模块全量加载完成）');
});

T.check(vm.runInContext("storeGet('nope')", D) === null, '存储被禁：读不存在的键应返回 null 而不是抛异常');
T.check(vm.runInContext("storeSet('k2','v2')", D) === false, '存储被禁：storeSet 应返回 false（表示已降级到内存）');
T.check(vm.runInContext("storeGet('k2')", D) === 'v2', '存储被禁：内存兜底必须能读回（同会话内自洽）');
vm.runInContext("storeDel('k2')", D);
T.check(vm.runInContext("storeGet('k2')", D) === null, '存储被禁：storeDel 应连内存兜底一起清掉');

/* ---------- ③ 降级后还得能玩：建队 → 存档 → 渲染 全流程 ---------- */
const r = vm.runInContext(`(function(){
  let e=null;
  try{
    S=newState('兜底测试队','icon');
    fillRoster(S,'mid');
    save();          // 存储不可用：应降级为内存 + 只提示一次，不抛
    save();          // 连存两次：第二次不该再弹提示（storeWarnOnce）
    renderAll();
    openSaveMgmt();  // 存档管理弹窗里那几处原先是裸读（occ / _auto），存储被禁时也不该炸
  }catch(err){e=String((err&&err.message)||err);}
  return {err:e, team:S&&S.teamName, players:S&&S.players.length, slot:curSlot};
})()`, D);
T.check(r.err === null, '存储被禁：建队→存档→渲染→开存档管理 不该抛异常（实得：' + r.err + '）');
T.check(r.players >= 5, '存储被禁：渲染后阵容应仍在（实得 ' + r.players + ' 人）');
T.check(r.slot === 1, '存储被禁：curSlot 应回落到 1（实得 ' + r.slot + '）');

/* ---------- ④ 负向验证：把兜底摘掉，同一个故障必须真的白屏 ---------- */
/* 直接在沙箱里把 storeGet 换成裸读，重现旧行为，证明这条门禁不是「永远通过」 */
const raw = vm.runInContext(`(function(){
  let e=null;
  try{ localStorage.getItem('x'); }catch(err){ e=String((err&&err.message)||err); }
  return e;
})()`, D);
T.check(/blocked/.test(raw || ''), '前提校验：被禁的 localStorage 裸读必须抛异常（实得：' + raw + '）');

T.report();
