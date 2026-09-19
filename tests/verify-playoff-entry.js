// 季后赛/卡位赛入口回归：证明「按钮点了没反应」这一类 bug 不会回来
// 根因（真人实测复现）：面板按钮把动作名字符串当状态传给 uiDoNextAction，
//   而 nextAction 第一行 `if(!s||!s.players…)return null` —— 字符串没有 .players，
//   于是永远返回 null，只弹一句误导的「当前没有可进行的比赛」。
//   实测：连点「快进季后赛」10 次，状态/界面/存档零变化。
// 运行：node tests/verify-playoff-entry.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { makeDom, loadCode } = require('./harness');

const errors = [];
const check = (c, m) => { if (!c) errors.push(m); };

// ──  静态：不得再有把字符串当状态传的调用点 ──────────────────────────
const bad = [];
fs.readdirSync(path.join(__dirname, '..', 'src', 'js')).forEach(f => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', f), 'utf8');
  src.split('\n').forEach((line, i) => {
    if (/uiDoNextAction\(\s*'/.test(line)) bad.push(f + ':' + (i + 1) + ' ' + line.trim().slice(0, 70));
  });
});
check(!bad.length, '① 仍有 uiDoNextAction(字符串) 调用点：\n     ' + bad.join('\n     '));

// ── 沙箱：造一个"玩家已出局、对阵表全是 AI"的季后赛局面（形状与 buildPlayoff 输出一致）──
function freshBracketState() {
  const { dom } = makeDom();
  vm.runInContext(`(function(){
    S=newState('看客队','看'); S.crest={sh:'shield',c1:'#123456',c2:'#000000',c3:'#ffffff',txt:'看'};
    S.selfBuilt=true; S.preseason=false; S.transferWindow=0;
    fillRoster(S,'mid');
    const M=()=>({a:null,b:null,r:null}), mm=(a,b)=>({a,b,r:null});
    S.playoff={wb:[mm('甲一','甲二'),mm('甲三','甲四')],lb:[mm('乙一','乙二'),mm('乙三','乙四')],
      lb2:[M(),M()],lb3:[M(),M()],wf:M(),lb4:M(),lbf:M(),final:M(),champ:null};
    S.phase='playoff'; S.stage='regular';
  })()`, dom);
  return dom;
}
const scored = p => [p.wb, p.lb, p.lb2, p.lb3].flat().concat([p.wf, p.lb4, p.lbf, p.final]).filter(m => m && m.r !== null).length;

// ② 旧调用形式（字符串）也必须能推进——这是归一化的直接证据
{
  const dom = freshBracketState();
  const before = vm.runInContext('JSON.stringify(S.playoff)', dom);
  const r = vm.runInContext(`(function(){
    const ls0=localStorage.getItem(slotKey())||'';
    uiDoNextAction('startPlayoff');                 // 故意保留旧的字符串写法
    return {after:JSON.stringify(S.playoff), ls1:(localStorage.getItem(slotKey())||'')!==ls0,
            a:nextAction(S)};
  })()`, dom);
  const n0 = scored(JSON.parse(before)), n1 = scored(JSON.parse(r.after));
  check(n1 > n0, `② 点「快进季后赛」（字符串入参）没推进任何场次：${n0} → ${n1}`);
  check(r.ls1, '② 季后赛推进后未写存档（刷新就丢进度）');
  check(r.a && r.a.type === 'startPlayoff', `② nextAction(S) 在季后赛期没给出入口：${JSON.stringify(r.a)}`);
}

// ③ 正确调用形式（传 S）同样推进
{
  const dom = freshBracketState();
  const before = vm.runInContext('JSON.stringify(S.playoff)', dom);
  vm.runInContext('uiDoNextAction(S)', dom);
  const after = vm.runInContext('JSON.stringify(S.playoff)', dom);
  check(scored(JSON.parse(after)) > scored(JSON.parse(before)), '③ 点「快进季后赛」（传 S）没推进场次');
}

// ④ 卡位赛入口：玩家在该轮有对阵时，nextAction 必须给出 startCard（而不是 null）
{
  const { dom } = makeDom();
  vm.runInContext(`(function(){
    S=newState('卡位队','卡'); S.crest={sh:'shield',c1:'#1',c2:'#2',c3:'#3',txt:'卡'};
    S.preseason=false;S.transferWindow=0;fillRoster(S,'mid');
    S.card={matches:[{a:S.teamName,b:'对手队',r:null}],idx:0};
    S.phase='card';S.stage='regular';
  })()`, dom);
  const a = vm.runInContext('JSON.stringify(nextAction(S))', dom);
  check(a && /startCard/.test(a), `④ 卡位赛期 nextAction 未给出入口：${a}`);
  const before = vm.runInContext('JSON.stringify(S.card)', dom);
  vm.runInContext("uiDoNextAction('startCard')", dom);   // 旧字符串写法同样要能用
  const after = vm.runInContext('JSON.stringify(S.card)', dom);
  check(before !== after || vm.runInContext('!!S.series', dom), '④ 点「进行卡位赛」后状态毫无变化（按钮是死的）');
}

if (errors.length) {
  console.log('[FAIL] 季后赛/卡位赛入口回归:\n  ' + errors.join('\n  '));
  process.exitCode = 1;
} else {
  console.log('[PASS] 季后赛/卡位赛入口回归：字符串入参归一化生效、两种调用形式都能推进场次并落盘、无残留坏调用点');
}
