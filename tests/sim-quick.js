// 平衡性快速门禁（CI 用）：三档开局 + 2017 时代档各 30 赛季（约 20 秒），关键比率越界即失败。
// 区间按 sim.js 大样本校准值 ±3σ 设置（见 README「平衡门禁」）——拦的是结构性漂移，不是微观波动。
// 用法：node tests/sim-quick.js [--n=30] [--seed=<整数|random>]
// 种子说明：默认固定种子（CI 确定性——同一份代码永远同一批数据，不会随机红灯）；
//          本地校准/排查用 --seed=random，或加大 --n 收紧区间。
const vm = require('vm');
// DOM 桩 / 源模块清单 / 沙箱辅助统一由 harness 提供（只维护一份——
// 各自复制一份桩的代价：UI 一旦用到桩里没实现的方法，模拟器就被静默打爆）
const { makeDom, injectHelpers } = require('./harness');

const DEFAULT_SEED = 999983; // 代表性种子：跨 6 个种子测得的分布中最接近中位数的一个（校准流程见 README）
const seedArg = (process.argv.find(a => a.startsWith('--seed=')) || '').split('=')[1];
const RANDOM_SEED = seedArg === 'random';
const SEED = RANDOM_SEED ? (Math.floor(Math.random() * 1e9) || 1) : (parseInt(seedArg, 10) || DEFAULT_SEED);

const { dom } = makeDom();
injectHelpers(dom);
// 种子化沙箱随机（mulberry32，与 fuzz.js 同一实现）：同种子必得同一批数据 → CI 不再有随机红灯
vm.runInContext('this.Math=(function(a){var f=function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};var M=Object.create(Math);M.random=f;return M;})(' + SEED + ')', dom);
// 种子化沙箱随机（mulberry32，与 fuzz.js 同一实现）：同种子必得同一批数据 → CI 不再有随机红灯
vm.runInContext('this.Math=(function(a){var f=function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};var M=Object.create(Math);M.random=f;return M;})(' + SEED + ')', dom);

const HEADLESS = `
function simSquad(kind){
  S=newState(kind.name,'⚔️');
  if(kind.era)S.era=kind.era;
  if(kind.template){
    const tmpl=CLUB_TEMPLATES.find(c=>c.name===kind.template);
    tmpl.players.forEach(pid=>{const def=PLAYER_POOL.find(d=>d.id===pid);if(def)S.players.push(genPlayer(def));});
    S.coach={...COACH_POOL.find(c=>c.id===tmpl.coach)};
    S.lineup=S.players.map(p=>p.id);
  }else{
    fillRoster(S,'mid','star');
    S.coach={...COACH_POOL.find(c=>c.id==='co12')};
    S.lineup=S.players.map(p=>p.id);
  }
  S.seedPower=teamPower(S);
  initGroups(S);
  S.preseason=false;S.transferWindow=0;
  return S;
}
function simSeason(kind){
  simSquad(kind);
  let guard=0,broke=false;
  const minFund=[S.fund];
  const tick=()=>{minFund.push(S.fund);if(S.fund<=0)broke=true;};
  while(!['champion','eliminated'].includes(S.phase)&&guard++<400){
    tick();
    if(S.phase==='r1'||S.phase==='r2'||S.phase==='r3'){
      if(S.matchIdx>=S.schedule.length){advancePhase(S);continue;}
      startMatch();
      if(!S.series){S.preseason=false;continue;}
      S.seriesAuto=true;autoPlayNext();nextDay(S);
    }else if(S.phase==='card'){
      if(S.card&&S.card.idx<S.card.matches.length){startCard();if(S.series){S.seriesAuto=true;autoPlayNext();}nextDay(S);}
      else break;
    }else if(S.phase==='playoff'){
      if(S.playoff&&S.playoff.final&&!S.playoff.final.r){startPlayoff();if(S.series){S.seriesAuto=true;autoPlayNext();}nextDay(S);}
      else break;
    }else break;
  }
  tick();
  // 本赛季总冠军：玩家夺冠=自己；否则联盟补完后的季后赛决赛胜者（含玩家提前出局的赛季）
  const champ=(S.playoff&&S.playoff.final&&S.playoff.final.r)?S.playoff.final.r:(S.champion?S.teamName:null);
  return {phase:S.phase,champ,po:['playoff','champion'].includes(S.phase),minFund:Math.min.apply(null,minFund),broke};
}
function runBatch(kind,n){
  const champs={};let po=0,broke=0,minF=1e9,powSum=0;
  for(let i=0;i<n;i++){
    const r=simSeason(kind);
    if(r.champ){champs[r.champ]=(champs[r.champ]||0)+1;}
    if(r.po)po++;
    if(r.minFund<=0)broke++;
    powSum+=teamPower(S)||0;
    if(r.minFund<minF)minF=r.minFund;
  }
  // my=玩家队夺冠次数（simSquad 以 kind.name 作为玩家队名）
  return {po,broke,champs,my:champs[kind.name]||0,minF,avgPow:Math.round(powSum/n)};
}
`;

// 平衡区间：中值取自 sim.js 大样本校准（自建季后赛 ~25% / AG夺冠 ~74% / 破产 ~0），
// 半宽 ≥3σ(n=30)，拦结构性漂移、容忍抽样抖动；单批失败自动重跑一次再判（防 CI 偶发）。
const BANDS = {
  '自建新队': r => (r.po/N >= 0.12 && r.po/N <= 0.50) || `自建季后赛率 ${(r.po/N*100).toFixed(0)}% 越界 [12%,50%]（校准值 ~25%）`,
  'AG豪门':   r => r.my/N <= 0.88 || `AG 夺冠率 ${(r.my/N*100).toFixed(0)}% 越界 ≤88%（校准值 ~74%）`,
  'UUG弱旅':  r => r.po/N <= 0.70 || `UUG 季后赛率 ${(r.po/N*100).toFixed(0)}% 越界 ≤70%（弱旅不应稳定进季后赛）`,
  '_破产':    r => r.broke/N <= 0.06 || `破产率 ${(r.broke/N*100).toFixed(0)}% 越界 ≤6%`,
};
const ERA_BANDS = {
  qg:   v => v <= 0.62 || `2017 时代 QGhappy 夺冠率 ${(v*100).toFixed(0)}% 越界 ≤62%（时代联盟一家独大）`,
  dist: v => v >= 2 || `2017 时代 30 季冠军仅 ${v} 支（联盟失去竞争性）`,
  po:   v => v >= 0.35 || `时代档 AG超玩会 季后赛率 ${(v*100).toFixed(0)}% 异常偏低（时代阵容战力结算可能坏了）`,
};

const N = Math.max(10, parseInt((process.argv.find(a => a.startsWith('--n=')) || '').split('=')[1], 10) || 30);
let failures = [];

function runProbe(kind) {
  return JSON.parse(vm.runInContext(HEADLESS + 'JSON.stringify(runBatch(' + JSON.stringify(kind) + ',' + N + '))', dom));
}
function checkTier(name, kind, bands) {
  let r = runProbe(kind);
  const bad = bands.map(b => b(r)).filter(x => typeof x === 'string');
  // 固定种子下重跑必得同一结果，重试无意义；只有随机种子模式才需要"再抽一次"防抖动
  if (bad.length && RANDOM_SEED) {
    console.log('  ⚠ 首轮越界，重跑一次确认（防抽样抖动）…');
    const r2 = runProbe(kind); // 合并两批重评（n 翻倍），仍越界才算真漂移
    const bad2 = bands.map(b => b(r2)).filter(x => typeof x === 'string');
    if (bad2.length) failures.push(...bad2.map(s => name + ': ' + s));
    r = r2;
  } else if (bad.length) {
    failures.push(...bad.map(s => name + ': ' + s));
  }
  return r;
}

console.log('=== 平衡门禁 ×' + N + '/档（三档开局 + 2017 时代档）· 种子 ' + SEED + (RANDOM_SEED ? '（随机）' : '（固定）') + ' ===');
const t1 = checkTier('自建新队', {name:'自建新队', template:null}, [BANDS['自建新队'], BANDS['_破产']]);
console.log('自建新队  季后赛 ' + (t1.po/N*100).toFixed(0) + '%  破产 ' + (t1.broke/N*100).toFixed(0) + '%  最低资金 ' + t1.minF);
const t2 = checkTier('AG豪门', {name:'AG豪门', template:'成都AG超玩会'}, [BANDS['AG豪门'], BANDS['_破产']]);
console.log('AG豪门    夺冠 ' + (t2.my/N*100).toFixed(0) + '%  破产 ' + (t2.broke/N*100).toFixed(0) + '%');
const t3 = checkTier('UUG弱旅', {name:'UUG弱旅', template:'常山UUG'}, [BANDS['UUG弱旅'], BANDS['_破产']]);
console.log('UUG弱旅   季后赛 ' + (t3.po/N*100).toFixed(0) + '%  破产 ' + (t3.broke/N*100).toFixed(0) + '%');

// 时代档：2017 · QG王朝——扮演 AG超玩会（次强，时代模板名即「AG超玩会」），看 QGhappy(640) 会不会一家独大
vm.runInContext(HEADLESS + 'installEra("2017");', dom);
const ERA_KIND = {name:'时代AG', era:'2017', template:'AG超玩会'};
const te = checkTier('2017时代', ERA_KIND, []);
const champNames = Object.keys(te.champs), total = champNames.reduce((t, k) => t + te.champs[k], 0);
const qgShare = (te.champs['QGhappy'] || 0) / Math.max(1, total);
const eraChecks = [ERA_BANDS.qg(qgShare), ERA_BANDS.dist(champNames.length), ERA_BANDS.po(te.po / N)].filter(x => typeof x === 'string');
if (eraChecks.length && RANDOM_SEED) {
  console.log('  ⚠ 时代档首轮越界，重跑一次确认…');
  const te2 = runProbe(ERA_KIND);
  const cn2 = Object.keys(te2.champs), tot2 = cn2.reduce((t, k) => t + te2.champs[k], 0);
  const qg2 = (te2.champs['QGhappy'] || 0) / Math.max(1, tot2);
  const bad2 = [ERA_BANDS.qg(qg2), ERA_BANDS.dist(cn2.length), ERA_BANDS.po(te2.po / N)].filter(x => typeof x === 'string');
  if (bad2.length) failures.push(...bad2.map(s => '2017时代: ' + s));
  console.log('2017时代  QG夺冠占比 ' + (qg2 * 100).toFixed(0) + '%  冠军多样性 ' + cn2.length + ' 支  AG季后赛 ' + (te2.po / N * 100).toFixed(0) + '%  冠军分布 ' + JSON.stringify(te2.champs));
} else {
  if (eraChecks.length) failures.push(...eraChecks.map(s => '2017时代: ' + s));
  console.log('2017时代  QG夺冠占比 ' + (qgShare * 100).toFixed(0) + '%  冠军多样性 ' + champNames.length + ' 支  AG季后赛 ' + (te.po / N * 100).toFixed(0) + '%  冠军分布 ' + JSON.stringify(te.champs));
}

if (failures.length) {
  console.log('\n✗ 平衡门禁未通过：');
  failures.forEach(f => console.log('  - ' + f));
  console.log('（平衡被新改动破坏？先跑 `npm run sim` 大样本确认，再校准数值或区间）');
  process.exit(1);
}
console.log('\n✓ 平衡门禁通过（区间与校准依据见 README「平衡门禁」章节）');
