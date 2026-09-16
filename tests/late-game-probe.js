// 后期长赛季压测：15~20 年全链路 + 更贴近真人的经营操作，收集异常与不变量失败
// 运行：node tests/late-game-probe.js [--n=15] [--seed=<int>|random] [--win]
const vm = require('vm');
const { makeDom, injectHelpers } = require('./harness');

const DEFAULT_SEED = 999983;
const seedArg = (process.argv.find(a => a.startsWith('--seed=')) || '').split('=')[1];
const RANDOM_SEED = seedArg === 'random';
const SEED = RANDOM_SEED ? (Math.floor(Math.random() * 1e9) || 1) : (parseInt(seedArg, 10) || DEFAULT_SEED);
const YEARS = Math.max(5, parseInt((process.argv.find(a => a.startsWith('--n=')) || '').split('=')[1], 10) || 15);
const FORCE_WIN = !process.argv.includes('--lose');

const { dom } = makeDom();
injectHelpers(dom);
vm.runInContext('this.Math=(function(a){var f=function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};var M=Object.create(Math);M.random=f;return M;})(' + SEED + ')', dom);

const HEADLESS = `
function forceSeries(win){
  if(!S.series)return false;
  S.series.mw=win?Math.ceil(S.series.max/2):1;
  S.series.ow=win?1:Math.ceil(S.series.max/2);
  finishSeries(win);
  return true;
}
function playLeague(win){
  let g=0;
  while(!['champion','eliminated'].includes(S.phase)&&g++<500){
    if(S.preseason){endPreseason(S);if(S.preseason){S.preseason=false;S.transferWindow=0;}}
    if(S.phase==='r1'||S.phase==='r2'||S.phase==='r3'){
      if(S.matchIdx>=(S.schedule||[]).length){advancePhase(S);continue;}
      if(S.series&&S.series.stage==='regular'){forceSeries(win);continue;}
      startMatch();
      if(!S.series){continue;}
      forceSeries(win);
    }else if(S.phase==='card'){
      if(S.series){forceSeries(win);continue;}
      startCard();
      if(S.series){forceSeries(win);continue;}
      if(!['champion','eliminated'].includes(S.phase)&&!(S.card&&S.card.idx<S.card.matches.length))break;
    }else if(S.phase==='playoff'){
      if(S.series){forceSeries(win);continue;}
      startPlayoff();
      if(S.series){forceSeries(win);continue;}
      if(!S.playoff||!S.playoff.final||S.playoff.final.r)break;
    }else break;
  }
}
function playCups(win){
  let g=0;
  while(g++<280){
    if(S.phase==='asiad'){
      let a=0;
      while(S.phase==='asiad'&&!(S.ag&&S.ag.champ)&&a++<40)asiadStep(S);
      continue;
    }
    if(S.phase!=='challenger'&&S.phase!=='ewc'&&S.phase!=='annual')break;
    if(S.series){forceSeries(win);continue;}
    startCup(S);
    if(S.series){forceSeries(win);continue;}
    if(S.phase==='challenger'&&S.challenger&&S.challenger.champ)continue;
    if(S.phase==='ewc'&&S.ewc&&S.ewc.champ)continue;
    if(S.phase==='annual'){
      const a=S.annual;
      if(a&&a.po&&a.po.champ)break;
      if(!a)break;
      continue;
    }
  }
}
function runOneYear(win){
  playLeague(win);
  advanceCalendar(S);
  playCups(win);
  if(S.split==='summer'){
    playLeague(win);
    advanceCalendar(S);
    playCups(win);
  }
}
function deepChk(tag){
  const bad=[];
  if(typeof S.fund!=='number'||isNaN(S.fund)||!isFinite(S.fund))bad.push('fund='+S.fund);
  if(S.fund<-100000)bad.push('fund异常低='+S.fund);
  const ww=weeklyWage(S);
  if(typeof ww!=='number'||isNaN(ww)||ww<0)bad.push('wage='+ww);
  const pw=teamPower(S);
  if(typeof pw!=='number'||isNaN(pw)||pw<=0)bad.push('power='+pw);
  if(!S.players||!S.players.length)bad.push('空名单');
  if(S.players&&S.players.length>12)bad.push('名单膨胀='+S.players.length);
  const seen=new Set();
  (S.players||[]).forEach(p=>{
    if(seen.has(p.id))bad.push('重复id '+p.id);
    seen.add(p.id);
    if(!p.name||/新人\\d+|新星\\d+|青训\\d+|新援\\d+|挑战者\\d+/.test(p.name))bad.push('占位名 '+p.name);
    (p.heroPool||[]).forEach(h=>{
      const hh=heroOf(h.n);
      if(!hh)bad.push('未知英雄 '+p.name+'/'+h.n);
      else if(!hh.pos.includes(p.pos))bad.push('错位英雄 '+p.name+'/'+h.n+'@'+p.pos);
    });
    if(p.val!=null&&isNaN(p.val))bad.push('val NaN '+p.name);
    if(p.attrs&&['lane','farm','team','mind'].some(k=>isNaN(p.attrs[k])))bad.push('attr NaN '+p.name);
    if(p.age!=null&&(p.age<14||p.age>40))bad.push('年龄越界 '+p.name+'='+p.age);
    if(p.morale!=null&&(p.morale<0||p.morale>100))bad.push('士气越界 '+p.name);
    if(p.energy!=null&&(p.energy<0||p.energy>ENERGY_MAX))bad.push('体力越界 '+p.name);
  });
  (S.lineup||[]).forEach(id=>{
    if(!S.players.some(p=>p.id===id))bad.push('首发幽灵 '+id);
  });
  const lpos={};
  (S.lineup||[]).forEach(id=>{
    const p=S.players.find(x=>x.id===id);
    if(p){if(lpos[p.pos])bad.push('首发位置重复 '+p.pos);lpos[p.pos]=1;}
  });
  if(S.captain&&!S.players.some(p=>p.id===S.captain))bad.push('队长幽灵');
  if(S.board&&S.board.trust!=null&&(S.board.trust<0||S.board.trust>100))bad.push('trust='+S.board.trust);
  if(!S.leagueTeams||S.leagueTeams.length!==18)bad.push('联盟'+((S.leagueTeams||[]).length));
  (S.leagueTeams||[]).forEach(tn=>{
    if(!tn)bad.push('联盟空队名');
  });
  // AI 名册幽灵：玩家已拥有的 def 不应还在 AI 注册表
  const map=aiRosterDefMap(S);
  Object.keys(map).forEach(tn=>{
    if(tn===S.teamName)return;
    map[tn].forEach(pid=>{
      if(S.players.some(p=>p.id===pid))bad.push('AI幽灵注册 '+tn+'/'+pid);
    });
  });
  if((S.eventLog||[]).length>5000)bad.push('eventLog膨胀='+S.eventLog.length);
  if((S.yearReviews||[]).length>YEARS_LIMIT+5)bad.push('yearReviews膨胀='+S.yearReviews.length);
  if((S.titleHistory||[]).length>50)bad.push('titleHistory膨胀='+S.titleHistory.length);
  if((S.honors||[]).length>YEARS_LIMIT*6+10)bad.push('honors膨胀='+S.honors.length);
  if(bad.length)return tag+' S'+S.season+' '+S.phase+': '+[...new Set(bad)].join(' / ');
  return null;
}
function topUpRoster(){
  const used=new Set((S.players||[]).map(p=>p.name));
  const add=(pos,band)=>{
    const def=genFreeAgentDef(pos,band||'low',used);
    used.add(def.name);
    S.players.push(genPlayer(def));
  };
  POS_ORDER.forEach(pos=>{if(!S.players.some(p=>p.pos===pos&&!p.loan))add(pos,'mid');});
  let g=0;
  while(S.players.length<7&&g++<12)add(pick(POS_ORDER),'low');
  const nat=new Set(S.natCampIds||[]);
  S.lineup=POS_ORDER.map(pos=>{
    const cand=S.players.filter(p=>p.pos===pos&&!p.loan&&!nat.has(p.id)).sort((a,b)=>playerPower(b)-playerPower(a));
    return cand[0]?cand[0].id:null;
  }).filter(Boolean);
  if(S.captain&&!S.players.some(p=>p.id===S.captain))S.captain=null;
}
function bizOps(tag,errs,notes){
  // 更接近真人：转会窗买卖/青训/队长/报价处理/市场刷新
  try{
    if(S.transferWindow>0||S.preseason){
      S.preseason=true;S.transferWindow=Math.max(S.transferWindow,3);
      buildTransferMarket(S);refreshMarket(S);
      const m=(S.market||[])[0];
      if(m&&S.fund>valueOf(overall(m))*0.5){
        try{buyPlayer(S,m);}catch(e){notes.push(tag+' buy: '+e.message);}
      }
      const victim=S.players.slice().sort((a,b)=>overall(b)-overall(a)).slice(-1)[0];
      if(victim&&S.lineup.indexOf(victim.id)<0&&S.players.length>5){
        try{completeSale(S,victim,80,'后期买家');}catch(e){notes.push(tag+' sell: '+e.message);}
      }
      if(S.academy&&S.academy.length){
        try{trainRookie(S,S.academy[0].id);}catch(e){notes.push(tag+' trainRookie: '+e.message);}
      }
      try{if(typeof recruitRookie==='function'&&S.fund>200)recruitRookie(S);}catch(e){notes.push(tag+' recruit: '+e.message);}
      S.preseason=false;S.transferWindow=0;
    }
    if(!S.captain&&S.lineup.length){
      try{setCaptain(S.lineup[0]);}catch(e){notes.push(tag+' captain: '+e.message);}
    }
    if((S.offers||[]).length){
      try{respondOffer(S,0,'keep');}catch(e){notes.push(tag+' offer: '+e.message);}
    }
    // UI 面板渲染：后期 undefined 最常炸在这里
    try{
      if(typeof renderClub==='function')renderClub();
      if(typeof renderMarket==='function')renderMarket();
      if(typeof renderLineup==='function')renderLineup();
      if(typeof renderLeague==='function')renderLeague();
      if(typeof renderHall==='function')renderHall();
      if(typeof renderReview==='function')renderReview();
    }catch(e){errs.push(tag+' render: '+(e&&e.message||e));}
  }catch(e){errs.push(tag+' biz: '+(e&&e.message||e));}
}
function sim(nYears,win){
  S=newState('后期压测','⚔️');
  fillRoster(S,'mid','star');
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  S.lineup=S.players.map(p=>p.id);
  S.seedPower=teamPower(S);
  initGroups(S);
  S.preseason=false;S.transferWindow=0;
  var errs=[],notes=[];
  let firedAt=null,yearsDone=0;
  for(let y=0;y<nYears;y++){
    try{
      runOneYear(win);
      yearsDone=y+1;
    }catch(e){
      errs.push('Y'+(y+1)+' 推进异常: '+(e&&e.message||e)+' @ '+(e&&e.stack||'').split('\\n')[1]);
      break;
    }
    const e1=deepChk('Y'+(y+1)+'完赛');
    if(e1)errs.push(e1);
    try{bizOps('Y'+(y+1),errs,notes);}catch(e){errs.push('Y'+(y+1)+' biz外层: '+(e&&e.message||e));}
    if(S.board&&S.board.fired&&firedAt==null){
      firedAt=S.season;
      try{nextDay(S);}catch(e){errs.push('解约后 nextDay: '+e.message);}
      break;
    }
    if(y<nYears-1){
      if(S.split!=='spring')errs.push('Y'+(y+1)+' 轮换后 split='+S.split);
      if(Object.keys(S.annualPts||{}).length)errs.push('Y'+(y+1)+' 年度积分未清零');
      topUpRoster();
    }
  }
  // 退役转教练路径（选手模式一条龙）——后期常有人想试
  try{
    if(typeof playerToCoach==='function'){
      // 只验证函数可解析，不强制切身份（避免污染 manager 压测）
    }
  }catch(e){errs.push('playerToCoach 解析: '+e.message);}
  return {yearsDone,firedAt,errs,notes,season:S.season,phase:S.phase,fund:S.fund,roster:S.players.length,titleHist:(S.titleHistory||[]).length,reviews:(S.yearReviews||[]).length,log:(S.eventLog||[]).length};
}
`;

console.log('=== 后期长赛季压测 ×' + YEARS + ' 年 · 种子 ' + SEED + (RANDOM_SEED ? '（随机）' : '（固定）') + ' · 强制胜负=' + (FORCE_WIN ? '胜' : '败') + ' ===');

const YEARS_LIMIT = YEARS;
let out;
try {
  out = JSON.parse(vm.runInContext('var YEARS_LIMIT=' + YEARS_LIMIT + ';\n' + HEADLESS + 'JSON.stringify(sim(' + YEARS + ',' + FORCE_WIN + '))', dom));
} catch (e) {
  console.log('✗ 沙箱异常: ' + (e && e.message || e));
  console.log(e && e.stack || '');
  process.exit(1);
}

console.log(
  '完赛 ' + out.yearsDone + ' 季' +
  (out.firedAt != null ? ' · 第' + out.firedAt + '季下课' : '') +
  ' · 终局 S' + out.season + ' ' + out.phase +
  ' · 资金 ' + out.fund +
  ' · 名单 ' + out.roster +
  ' · 冠军史 ' + out.titleHist +
  ' · 年度回顾 ' + out.reviews +
  ' · 日志 ' + out.log
);
if (out.notes && out.notes.length) {
  console.log('notes:');
  out.notes.slice(0, 20).forEach(n => console.log('  · ' + n));
}

const failures = out.errs || [];
if (out.yearsDone < YEARS && out.firedAt == null) {
  failures.push('未跑满 ' + YEARS + ' 年且未下课（实际 ' + out.yearsDone + '）');
}

if (failures.length) {
  console.log('\n✗ 后期压测发现问题 ' + failures.length + ' 条：');
  failures.forEach(f => console.log('  - ' + f));
  process.exit(1);
} else {
  console.log('\n✓ 后期长赛季压测通过（' + out.yearsDone + ' 年无异常）');
}
