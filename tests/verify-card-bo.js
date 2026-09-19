// 卡位赛 BO 数回归（2026 公开报道口径：卡位赛在常规赛第二轮进行、BO5，胜者进第三轮 S 组、负者淘汰）
// 旧实现按 BO7 打生死战，且 BO 数散落在 season.js 的 6 处调用 + ui.js 的 3 处文案里。
// 现在收进 KPL.CARD 单点，本用例钉住：① 常量值 ② 我队系列赛总局数 ③ AI 侧局数上限 ④ 文案不许回潮成字面 BO7
// 运行：node tests/verify-card-bo.js
const fs = require('fs');
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const ok=t=>res.push('[PASS] '+t);
  const _ra=renderAll,_sv=save;renderAll=function(){};save=function(){};

  // ① 口径常量
  if(KPL.CARD!==5)fail('① KPL.CARD='+KPL.CARD+'，2026 口径应为 5');
  else ok('① KPL.CARD=5（卡位赛 BO5）');

  // ② 我队卡位赛：series.max 取 KPL.CARD（直接搭出"我队待打卡位赛"的确定态，不靠推进运气）
  S=newState('卡位队','x');fillRoster(S,'mid','star');
  S.coach={...COACH_POOL.find(c=>c.id==='co1')};
  S.lineup=S.players.map(p=>p.id);
  S.seedPower=teamPower(S);initGroups(S);
  S.groups={S:[S.teamName,'重庆狼队','武汉eStarPro','北京WB','济南RW侠','成都AG超玩会'],A:['广州TTG','上海RNG.M','长沙滔搏','杭州LGD','南京Hero','苏州KSG']};
  S.phase='card';
  S.card={matches:[{a:S.teamName,b:'重庆狼队',r:null,winTo:'S'}],idx:0};
  startCard();
  if(!S.series)fail('② startCard 未开启系列赛');
  else if(S.series.max!==KPL.CARD)fail('② 我队卡位赛 series.max='+S.series.max+'，应为 '+KPL.CARD);
  else{
    const games=S.series.max;
    S.series.mw=2;S.series.ow=2;
    let threw=null;
    try{finishSeries(true);}catch(e){threw=e.message;}
    if(threw)fail('② 2:2 后打第 '+games+' 局定胜负时抛错: '+threw);
    else ok('② 我队卡位赛 series.max='+games+'（=KPL.CARD）· 2:2 后第 '+games+' 局收尾不抛');
  }

  // ③ AI 侧卡位赛：simSeriesResult 总局数不超过 KPL.CARD
  S=newState('AI卡位队','x');fillRoster(S,'mid');
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  S.lineup=S.players.map(p=>p.id);S.seedPower=400;initGroups(S);
  setupCard(S);
  let maxGames=0;
  (S.card.matches||[]).forEach(m=>{
    if(m.r)return;
    const r=simSeriesResult(S,m.a,m.b,KPL.CARD);
    const games=(r.mw||0)+(r.ow||0);
    if(games>maxGames)maxGames=games;
  });
  if(maxGames>KPL.CARD)fail('③ AI 卡位赛打出 '+maxGames+' 局 > '+KPL.CARD);
  else ok('③ AI 侧卡位赛场次 '+S.card.matches.length+' 场 · 最长 '+maxGames+' 局（≤'+KPL.CARD+'）');
  if(S.card.matches.length!==4)fail('③ 卡位赛应为 4 场（S5vsA2/S6vsA1/A5vsB2/A6vsB1），实为 '+S.card.matches.length);
  else ok('③ 卡位赛 4 场对阵结构未动');

  renderAll=_ra;save=_sv;
  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; '));
  return res.join('\\n');
})()
`, dom);

console.log(out);

// ④ 静态守卫：文案与引擎都不许再出现"卡位赛 BO7"
const bad = [];
const scan = (f, re, why) => {
  fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((ln, i) => { if (re.test(ln)) bad.push(f + ':' + (i + 1) + ' ' + why + ' | ' + ln.trim().slice(0, 80)); });
};
scan('src/js/season.js', /卡位赛.{0,12}BO7/, '引擎注释/文案回潮 BO7');
scan('src/js/ui.js', /卡位赛[\s\S]{0,80}>\s*BO7|BO7 · 含巅峰对决/, 'UI 卡位赛标签写死 BO7');
const ui = fs.readFileSync('src/js/ui.js', 'utf8');
if ((ui.match(/BO\$\{KPL\.CARD\}/g) || []).length < 2) bad.push('ui.js 卡位赛 tag 没读 KPL.CARD（应至少 2 处）');
console.log(bad.length ? '[FAIL] ④ ' + bad.join('\n     ') : '[PASS] ④ 静态守卫：卡位赛 BO 数只在 KPL.CARD 一处');
if (bad.length) process.exitCode = 1;
