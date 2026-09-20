// 年终全链路门禁：补齐 sim-quick 单赛段覆盖不到的挑战者杯 / EWC / 亚运 / 年总 / 董事会结算。
// 固定种子、强制系列赛胜负（仍走真实入口 finishSeries/startCup/asiadStep/advanceCalendar），
// 每年末断言：董事会信任度越界、解约态可续跑、年度积分轮换、资金/名单健全、圣龙杯已产出。
// 用法：node tests/sim-yearend.js [--n=8] [--seed=<整数|random>]
const vm = require('vm');
const { makeDom, injectHelpers } = require('./harness');

const DEFAULT_SEED = 999983;
const seedArg = (process.argv.find(a => a.startsWith('--seed=')) || '').split('=')[1];
const RANDOM_SEED = seedArg === 'random';
const SEED = RANDOM_SEED ? (Math.floor(Math.random() * 1e9) || 1) : (parseInt(seedArg, 10) || DEFAULT_SEED);
const YEARS = Math.max(3, parseInt((process.argv.find(a => a.startsWith('--n=')) || '').split('=')[1], 10) || 8);

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
  while(!['champion','eliminated'].includes(S.phase)&&g++<400){
    if(S.preseason){S.preseason=false;S.transferWindow=0;continue;}
    if(S.phase==='r1'||S.phase==='r2'||S.phase==='r3'){
      if(S.matchIdx>=S.schedule.length){advancePhase(S);continue;}
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
  while(g++<220){
    if(S.phase==='asiad'){
      let a=0;
      while(S.phase==='asiad'&&!(S.ag&&S.ag.champ)&&a++<30)asiadStep(S);
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
  return {
    season:S.season,split:S.split,phase:S.phase,
    fired:!!(S.board&&S.board.fired),
    trust:S.board&&S.board.trust!=null?S.board.trust:null,
    annualChamp:S.annual&&S.annual.po?S.annual.po.champ:null,
    fund:S.fund,
  };
}
function chk(where,kind){
  const bad=[];
  if(typeof S.fund!=='number'||isNaN(S.fund))bad.push('fund='+S.fund);
  if(typeof teamPower(S)!=='number'||isNaN(teamPower(S)))bad.push('power NaN');
  if(S.board&&S.board.trust!=null&&(S.board.trust<0||S.board.trust>100))bad.push('trust越界='+S.board.trust);
  if(S.lineup&&S.lineup.length>5)bad.push('首发'+S.lineup.length);
  if(!S.leagueTeams||S.leagueTeams.length!==18)bad.push('联盟'+((S.leagueTeams||[]).length)+'队');
  if(S.players&&S.players.length<3)bad.push('名单过少='+S.players.length);
  // 名单重复 id：教练档的自动引援/申请直签一旦不查归属就会翻倍（2026-09-20 加守卫的那条）
  const ids=(S.players||[]).map(p=>p.id);
  const dupN=ids.length-new Set(ids).size;
  if(dupN)bad.push('名单重复 id '+dupN+' 个');
  // 教练档自由市场必须一直在：它是「申请直签/引援建议/缺位签约」三条出口的唯一货源
  if(kind&&kind.mode==='coach'&&!(S.freeAgents||[]).length)bad.push('教练档 freeAgents 为空');
  if(bad.length)return where+': '+bad.join(' / ');
  return null;
}
function topUpRoster(){
  // 年度轮换会自然退役；年终门禁不测转会经营，缺位自动补签并重建首发
  const used=new Set((S.players||[]).map(p=>p.name));
  const add=(pos,band)=>{
    const def=genFreeAgentDef(pos,band||'low',used);
    used.add(def.name);
    S.players.push(genPlayer(def));
  };
  POS_ORDER.forEach(pos=>{if(!S.players.some(p=>p.pos===pos))add(pos,'mid');});
  let g=0;
  while(S.players.length<7&&g++<12)add(pick(POS_ORDER),'low');
  const nat=new Set(S.natCampIds||[]);
  S.lineup=POS_ORDER.map(pos=>{
    const cand=S.players.filter(p=>p.pos===pos&&!p.loan&&!nat.has(p.id)).sort((a,b)=>playerPower(b)-playerPower(a));
    return cand[0]?cand[0].id:null;
  }).filter(Boolean);
}
function sim(kind,nYears){
  S=newState(kind.name,'⚔️');
  // 三身份走同一条全链路：mode 决定 startSplit/newSeason 里的是哪条分支
  if(kind.mode)S.mode=kind.mode;
  if(kind.mode==='coach')S.coachDeal={years:2,honors:[],log:[]}; // 豪门邀约/执教履历/合同年数都读它
  if(kind.template){
    const tmpl=CLUB_TEMPLATES.find(c=>c.name===kind.template);
    if(kind.mode==='coach')S.fund=tmpl.budget; // 教练档：资金是俱乐部的，按模板预算起
    tmpl.players.forEach(pid=>{const def=PLAYER_POOL.find(d=>d.id===pid);if(def)S.players.push(genPlayer(def));});
    S.coach={...COACH_POOL.find(c=>c.id===tmpl.coach)};
    S.lineup=S.players.map(p=>p.id);
  }else{
    fillRoster(S,kind.band||'mid',kind.star||kind.band||'mid');
    S.coach={...COACH_POOL.find(c=>c.id==='co12')};
    S.lineup=S.players.map(p=>p.id);
  }
  S.seedPower=teamPower(S);
  initGroups(S);
  S.preseason=false;S.transferWindow=0;
  const errs=[],notes=[];
  let annualChamps=0,firedAt=null,yearsDone=0,poached=0,poachedNow=false;
  for(let y=0;y<nYears;y++){
    poachedNow=false;
    const r=runOneYear(kind.win!==false);
    yearsDone=y+1;
    const e=chk('Y'+(y+1),kind);
    if(e){errs.push(e);break;}
    if(r.annualChamp)annualChamps++;
    // 教练档年结会被豪门挖角：接受=换队重建班底——市场不跟着重建就会把新班底的人再签一遍
    if(S.coachOffer){
      poached++;poachedNow=true;
      const want=S.coachOffer.team;
      respondCoachOffer(true);
      if(S.teamName!==want)errs.push('Y'+(y+1)+' 接受邀约没换成 '+want+'（实际 '+S.teamName+'）');
      // 市场没跟着重建的直接证据：旧市场是按「旧东家」排除建的，新东家的选手必然还挂在上面
      // （transferList 每条都带 ownerTeam，比只查 3 个 freeAgents 撞不撞得到确定得多）
      const stale=(S.transferList||[]).filter(p=>p.ownerTeam===S.teamName).length;
      if(stale)errs.push('Y'+(y+1)+' 换队后市场仍按旧东家建：transferList 里挂着本队选手 '+stale+' 名');
      const ids=new Set((S.players||[]).map(p=>p.id));
      const hit=(S.freeAgents||[]).filter(p=>ids.has(p.id)).length;
      if(hit)errs.push('Y'+(y+1)+' 换队后 freeAgents 里仍含新班底选手 '+hit+' 名');
      if(chk('换队后 Y'+(y+1),kind))errs.push(chk('换队后 Y'+(y+1),kind));
    }
    if(r.fired&&firedAt==null){
      firedAt=r.season;
      // 软终局：底层仍可推进（verify-board ⑨ 守 UI；这里守引擎侧）
      const day0=S.day;
      nextDay(S);
      if(S.day===day0)errs.push('解约后 nextDay 被阻塞');
      break;
    }
    // 年度轮换后：新一年春季、积分清零；补员防退役缩编卡死
    if(y<nYears-1){
      if(S.split!=='spring')errs.push('轮换后 split 异常: '+S.split);
      if(Object.keys(S.annualPts||{}).length)errs.push('新一年年度积分未清零');
      topUpRoster();
      if(chk('轮换后 Y'+(y+1),kind))errs.push(chk('轮换后 Y'+(y+1),kind));
    }
    notes.push('S'+r.season+(r.fired?'[下课]':'')+(poachedNow?'['+S.teamName+']':'')+' 龙杯='+(r.annualChamp||'-')+' trust='+(r.trust==null?'-':r.trust));
  }
  return {yearsDone,annualChamps,firedAt,errs,挖角换队:poached,notes:notes.join(' · ')};
}
`;

console.log('=== 年终全链路门禁 ×' + YEARS + ' 年/档 · 种子 ' + SEED + (RANDOM_SEED ? '（随机）' : '（固定）') + ' ===');

// 教练档排在最后跑：沙箱随机数在同一 dom 里跨年累积，加在中间会挪动后面所有档的种子轨迹
const KINDS = [
  { name: '自建新队', template: null, band: 'mid', star: 'star', win: true },
  { name: 'AG豪门', template: '成都AG超玩会', win: true },
  { name: 'UUG弱旅', template: '常山UUG', win: false },
  { name: '低配鱼腩', template: null, band: 'low', win: false },
  // 竞技归你、钱与引援归俱乐部：走 startSplit 的 coach 分支（自动续约/补缺 + 自由市场货源）
  { name: '教练豪门', mode: 'coach', template: '成都AG超玩会', win: true },
  { name: '教练鱼腩', mode: 'coach', template: '常山UUG', win: false },
];

const failures = [];
for (const kind of KINDS) {
  let r;
  try {
    r = JSON.parse(vm.runInContext(HEADLESS + 'JSON.stringify(sim(' + JSON.stringify(kind) + ',' + YEARS + '))', dom));
  } catch (e) {
    failures.push(kind.name + ': 沙箱异常 ' + (e && e.message || e));
    console.log(kind.name + '  异常: ' + (e && e.message || e));
    continue;
  }
  console.log(
    kind.name.padEnd(6) +
    '  完赛 ' + r.yearsDone + ' 季' +
    '  圣龙杯 ' + r.annualChamps +
    (r.firedAt != null ? '  第' + r.firedAt + '季下课' : '') +
    '  ' + r.notes
  );
  r.errs.forEach(e => failures.push(kind.name + ': ' + e));
  // 至少跑完预定年数，或在中途合法下课退出
  if (r.yearsDone < YEARS && r.firedAt == null) {
    failures.push(kind.name + ': 未跑满 ' + YEARS + ' 年且未下课（实际 ' + r.yearsDone + '）');
  }
  // 全胜档至少应产出过圣龙杯（弱旅允许 0）
  if (kind.win && r.annualChamps < 1) {
    failures.push(kind.name + ': 全胜档 ' + YEARS + ' 年未产出圣龙杯');
  }
}

if (failures.length) {
  console.log('\n✗ 年终全链路门禁未通过：');
  failures.forEach(f => console.log('  - ' + f));
  process.exit(1);
}
console.log('\n✓ 年终全链路门禁通过（挑杯/亚运/年总/董事会结算均走通）');
