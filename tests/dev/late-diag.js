// 临时诊断：12~20 年全链路，抓膨胀/幽灵/年总指针/名单缩编/资金与王朝
// 运行：node tests/late-diag.js --n=16 --seed=999983
const vm = require('vm');
const { makeDom, injectHelpers } = require('../harness');

const seedArg = (process.argv.find(a => a.startsWith('--seed=')) || '').split('=')[1];
const SEED = seedArg ? (parseInt(seedArg, 10) || 1) : 999983;
const YEARS = Math.max(5, parseInt((process.argv.find(a => a.startsWith('--n=')) || '').split('=')[1], 10) || 16);
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
  while(!['champion','eliminated'].includes(S.phase)&&g++<600){
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
  while(g++<400){
    if(S.phase==='asiad'){
      let a=0;
      while(S.phase==='asiad'&&!(S.ag&&S.ag.champ)&&a++<50)asiadStep(S);
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
function snapshot(tag){
  const snap={tag,season:S.season,phase:S.phase,split:S.split};
  snap.extraDefs=(S.extraDefs||[]).length;
  snap.retiredDefs=(S.retiredDefs||[]).length;
  snap.aiAcademyTeams=Object.keys(S.aiAcademy||{}).length;
  snap.aiAcademyIds=Object.values(S.aiAcademy||{}).reduce((t,a)=>t+(a?a.length:0),0);
  snap.roster=S.players.length;
  snap.lineup=(S.lineup||[]).length;
  snap.fund=S.fund;
  snap.titleHist=(S.titleHistory||[]).length;
  snap.reviews=(S.yearReviews||[]).length;
  snap.honors=(S.honors||[]).length;
  snap.eventLog=(S.eventLog||[]).length;
  snap.retiredCoaches=(S.retiredCoaches||[]).length;
  snap.mentorPairs=(S.mentorPairs||[]).length;
  snap.dynasty=dynastyStreak(S,S.teamName);
  snap.saveBytes=0;
  try{snap.saveBytes=(serializeForSave(S)||'').length;}catch(e){snap.saveBytes=-1;}
  return snap;
}
function inv(tag){
  const bad=[];
  // 资金
  if(typeof S.fund!=='number'||isNaN(S.fund)||!isFinite(S.fund))bad.push('fund='+S.fund);
  // 名单
  if(!S.players||!S.players.length)bad.push('空名单');
  const seen=new Set();
  (S.players||[]).forEach(p=>{
    if(seen.has(p.id))bad.push('重复id '+p.id);
    seen.add(p.id);
    if(p.val!=null&&isNaN(p.val))bad.push('valNaN '+p.name);
    if(p.attrs&&['lane','farm','team','mind'].some(k=>isNaN(p.attrs[k])))bad.push('attrNaN '+p.name);
    if(p.age!=null&&(p.age<14||p.age>45))bad.push('年龄越界 '+p.name+'='+p.age);
  });
  (S.lineup||[]).forEach(id=>{
    if(!S.players.some(p=>p.id===id))bad.push('首发幽灵 '+id);
  });
  if(S.captain&&!S.players.some(p=>p.id===S.captain))bad.push('队长幽灵');
  // mentor 幽灵
  (S.mentorPairs||[]).forEach(pr=>{
    if(!S.players.some(p=>p.id===pr.v)||!S.players.some(p=>p.id===pr.r))bad.push('mentor幽灵 '+pr.v+'/'+pr.r);
  });
  // aiAcademy 幽灵：id 必须能 defOf 解析；且不应与玩家名单重叠
  Object.keys(S.aiAcademy||{}).forEach(tn=>{
    (S.aiAcademy[tn]||[]).forEach(id=>{
      const d=defOf(S,id);
      if(!d)bad.push('aiAcademy幽灵def '+tn+'/'+id);
      if(S.players.some(p=>p.id===id))bad.push('aiAcademy占用玩家 '+tn+'/'+id);
      if((S.retiredDefs||[]).includes(id))bad.push('aiAcademy已退役 '+tn+'/'+id);
    });
  });
  // AI 名册幽灵
  const map=aiRosterDefMap(S);
  Object.keys(map).forEach(tn=>{
    if(tn===S.teamName)return;
    if(map[tn].length>5)bad.push('AI超编 '+tn+'='+map[tn].length);
    map[tn].forEach(pid=>{
      if(S.players.some(p=>p.id===pid))bad.push('AI幽灵注册 '+tn+'/'+pid);
      if(!defOf(S,pid))bad.push('AI缺def '+tn+'/'+pid);
    });
    const poss=map[tn].map(id=>{const d=defOf(S,id);return d&&d.pos;}).filter(Boolean);
    const dup=poss.filter((p,i)=>poss.indexOf(p)!==i);
    if(dup.length&&map[tn].length===5)bad.push('AI位置重复 '+tn+':'+dup.join(''));
  });
  // 联盟队
  if(!S.leagueTeams||S.leagueTeams.length!==18)bad.push('联盟'+((S.leagueTeams||[]).length));
  // 年总指针
  const a=S.annual;
  if(a){
    if(!a.masters||a.masters.length!==6)bad.push('masters='+((a.masters||[]).length));
    if(!a.elites||a.elites.length!==6)bad.push('elites='+((a.elites||[]).length));
    if(a.masters&&a.elites){
      a.masters.forEach(t=>{if(!t)bad.push('masters空指针');});
      a.elites.forEach(t=>{if(!t)bad.push('elites空指针');});
      const inter=a.masters.filter(t=>a.elites.includes(t));
      if(inter.length)bad.push('masters/elites重叠 '+inter.join(','));
    }
    if(a.rounds){
      a.rounds.flat().forEach(m=>{
        if(m.a==null||m.b==null)bad.push('擂台空对阵');
        if(m.r&&!['a','b'].includes(m.r===m.a?'a':m.r===m.b?'b':'x'))bad.push('擂台胜者异常');
      });
    }
  }
  // titleHistory 结构
  (S.titleHistory||[]).forEach((t,i)=>{
    if(!t.champ)bad.push('title空champ@'+i);
    if(t.season==null)bad.push('title空season@'+i);
  });
  // 阵容位置（转会期外）
  if(!S.preseason){
    const miss=POS_ORDER.filter(pos=>!S.players.some(p=>p.pos===pos&&!p.loan&&!p.loanOut));
    if(miss.length)bad.push('缺位置 '+miss.join(','));
    if(S.players.length<5)bad.push('名单<5 ='+S.players.length);
  }
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
function bizOps(tag){
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
        try{promoteRookie(S,S.academy[0].id);}catch(e){notes.push(tag+' promote: '+e.message);}
      }
      try{trainAcademy(S);}catch(e){notes.push(tag+' academy: '+e.message);}
      S.preseason=false;S.transferWindow=0;
    }
    if(!S.captain&&S.lineup.length){
      try{appointCaptain(S,S.lineup[0]);}catch(e){notes.push(tag+' captain: '+e.message);}
    }
    if((S.offers||[]).length){
      try{respondOffer(S,0,'keep');}catch(e){notes.push(tag+' offer: '+e.message);}
    }
  }catch(e){errs.push(tag+' biz: '+e.message);}
}
function sim(nYears,win){
  S=newState('后期压测','⚔️');
  fillRoster(S,'mid','star');
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  S.lineup=S.players.map(p=>p.id);
  S.seedPower=teamPower(S);
  initGroups(S);
  S.preseason=false;S.transferWindow=0;
  var errs=[],notes=[],snaps=[];
  let firedAt=null,yearsDone=0;
  snaps.push(snapshot('开局'));
  for(let y=0;y<nYears;y++){
    try{
      runOneYear(win);
      yearsDone=y+1;
    }catch(e){
      errs.push('Y'+(y+1)+' 推进异常: '+(e&&e.message||e)+' @ '+(e&&e.stack||'').split('\\n').slice(1,3).join(' | '));
      snaps.push(snapshot('异常Y'+(y+1)));
      break;
    }
    snaps.push(snapshot('Y'+(y+1)+'完赛'));
    const e1=inv('Y'+(y+1)+'完赛');
    if(e1)errs.push(e1);
    try{bizOps('Y'+(y+1));}catch(e){errs.push('Y'+(y+1)+' biz外层: '+e.message);}
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
  // 专项：名单缩编路径 —— 不 top-up，看 newSeason 后是否 <5 且 nextDay 自动开赛是否放行
  const shrink={};
  try{
    shrink.rosterBefore=S.players.length;
    // 强制老化到退役线再 newSeason
    S.players.forEach(p=>{p.age=(AGE_MODEL[p.pos]||AGE_MODEL.mid).retire;});
    const before=S.players.length;
    // 用年终路径：先把 annual 收掉触发 newSeason
    // 若已在春季则直接调用 newSeason（引擎函数，与年终同逻辑）
    const line0=S.lineup.slice();
    newSeason(S);
    shrink.rosterAfter=S.players.length;
    shrink.lineupAfter=S.lineup.length;
    shrink.preseason=S.preseason;
    shrink.missPos=POS_ORDER.filter(pos=>!S.players.some(p=>p.pos===pos)).join(',');
    // 模拟 nextDay 把转会窗耗尽
    let g=0;
    while(S.preseason&&S.transferWindow>0&&g++<20)nextDay(S);
    shrink.afterAutoEndPreseason=S.preseason;
    shrink.phaseAfterAuto=S.phase;
    shrink.missAfterAuto=POS_ORDER.filter(pos=>!S.players.some(p=>p.pos===pos)).join(',');
    shrink.couldStart=startMatch? (function(){try{startMatch();return !!(S.series);}catch(e){return 'throw:'+e.message;}})() : null;
  }catch(e){shrink.err=e.message;}
  // 专项：extraDefs 杯赛污染统计
  const tagCount={};
  (S.extraDefs||[]).forEach(d=>{
    const t=(d.id||'').split('_')[0].replace(/\\d+$/,'');
    tagCount[t]=(tagCount[t]||0)+1;
  });
  return {
    yearsDone,firedAt,errs,notes:[...new Set(notes)],
    snaps,shrink,tagCount,
    season:S.season,phase:S.phase,fund:S.fund,
    dynasty:dynastyStreak(S,S.teamName),
    titleHist:(S.titleHistory||[]).slice(-8),
  };
}
`;

console.log('=== 后期诊断 ×' + YEARS + ' 年 · 种子 ' + SEED + ' · 胜=' + FORCE_WIN + ' ===');
let out;
try {
  out = JSON.parse(vm.runInContext(HEADLESS + 'JSON.stringify(sim(' + YEARS + ',' + FORCE_WIN + '))', dom));
} catch (e) {
  console.log('✗ 沙箱异常: ' + (e && e.message || e));
  console.log(e && e.stack || '');
  process.exit(1);
}

console.log('完赛 ' + out.yearsDone + ' 季' + (out.firedAt != null ? ' · 第' + out.firedAt + '季下课' : ''));
console.log('终局 S' + out.season + ' ' + out.phase + ' fund=' + out.fund + ' dynasty=' + out.dynasty);
console.log('extraDefs 标签分布: ' + JSON.stringify(out.tagCount));
console.log('titleHist 尾部: ' + JSON.stringify(out.titleHist));
console.log('\n年度快照（extra/retired/academy/roster/saveKB）:');
out.snaps.forEach(s => {
  console.log(
    '  ' + String(s.tag).padEnd(10) +
    ' extra=' + String(s.extraDefs).padStart(5) +
    ' retired=' + String(s.retiredDefs).padStart(4) +
    ' acTeams=' + String(s.aiAcademyTeams).padStart(3) +
    ' acIds=' + String(s.aiAcademyIds).padStart(4) +
    ' roster=' + String(s.roster).padStart(3) +
    ' lineup=' + String(s.lineup).padStart(2) +
    ' fund=' + String(Math.round(s.fund)).padStart(7) +
    ' TH=' + String(s.titleHist).padStart(2) +
    ' reviews=' + String(s.reviews).padStart(2) +
    ' log=' + String(s.eventLog).padStart(4) +
    ' saveKB=' + (s.saveBytes > 0 ? Math.round(s.saveBytes / 1024) : s.saveBytes) +
    ' dyn=' + s.dynasty
  );
});
console.log('\n名单缩编专项: ' + JSON.stringify(out.shrink, null, 0));
if (out.notes && out.notes.length) {
  console.log('\nnotes:');
  out.notes.slice(0, 15).forEach(n => console.log('  · ' + n));
}
const failures = out.errs || [];
if (failures.length) {
  console.log('\n✗ 发现问题 ' + failures.length + ' 条：');
  failures.forEach(f => console.log('  - ' + f));
  process.exit(1);
} else {
  console.log('\n✓ 诊断通过（无断言失败；膨胀指标见上表）');
}
