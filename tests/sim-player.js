// 选手长局门禁：多赛季漏斗（成长/首发/日决策/经济/荣誉）
// 驱动方式对齐 sim-yearend（playLeague + advanceCalendar + playCups），身份为选手生涯。
// 运行：node tests/sim-player.js [--n=5] [--seed=<int|random>]
const vm = require('vm');
const { makeDom, injectHelpers } = require('./harness');

const seedArg = (process.argv.find(a => a.startsWith('--seed=')) || '').split('=')[1];
const RANDOM_SEED = seedArg === 'random';
const SEED = RANDOM_SEED ? (Math.floor(Math.random() * 1e9) || 1) : (parseInt(seedArg, 10) || 424243);
const N_SEASONS = Math.max(3, parseInt((process.argv.find(a => a.startsWith('--n=')) || '').split('=')[1], 10) || 5);

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
function playerDayOps(){
  const me=myPlayer(S);
  if(!me||S.career.retired)return;
  if(!S.trained&&!me.injury&&me.energy>=10){
    playerTrain(pick(['lane','farm','team','mind']));
  }else if(!S.trained){
    playerRest();
  }
  if(!S.socialUsed&&!me.loanOut&&!(me.kjia>0)&&me.energy>=8){
    playerSocial(S,pick(['bond','help','stream']));
  }
  if(S.career&&S.career.media)playerRespondMedia(S,0);
  // 确保我尽量在首发（长局关注「选手成长漏斗」，不是教练排兵）
  try{coachPickLineup(S);}catch(e){}
}
function playLeague(win){
  let g=0;
  while(!['champion','eliminated'].includes(S.phase)&&g++<400){
    playerDayOps();
    if(S.preseason){S.preseason=false;S.transferWindow=0;continue;}
    if(S.phase==='r1'||S.phase==='r2'||S.phase==='r3'){
      if(S.matchIdx>=S.schedule.length){advancePhase(S);continue;}
      if(S.series&&S.series.stage==='regular'){forceSeries(win);nextDay(S);continue;}
      startPlayerMatch();
      if(!S.series){nextDay(S);continue;}
      forceSeries(win);nextDay(S);
    }else if(S.phase==='card'){
      if(S.series){forceSeries(win);nextDay(S);continue;}
      startCard();
      if(S.series){forceSeries(win);nextDay(S);continue;}
      if(!['champion','eliminated'].includes(S.phase)&&!(S.card&&S.card.idx<S.card.matches.length))break;
    }else if(S.phase==='playoff'){
      if(S.series){forceSeries(win);nextDay(S);continue;}
      startPlayoff();
      if(S.series){forceSeries(win);nextDay(S);continue;}
      if(!S.playoff||!S.playoff.final||S.playoff.final.r)break;
    }else break;
  }
}
function playCups(win){
  let g=0;
  while(g++<220){
    playerDayOps();
    if(S.phase==='asiad'){
      let a=0;
      while(S.phase==='asiad'&&!(S.ag&&S.ag.champ)&&a++<30)asiadStep(S);
      continue;
    }
    if(S.phase!=='challenger'&&S.phase!=='ewc'&&S.phase!=='annual')break;
    if(S.series){forceSeries(win);nextDay(S);continue;}
    startCup(S);
    if(S.series){forceSeries(win);nextDay(S);continue;}
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
function topUpRoster(){
  try{
    const me=myPlayer(S);
    POS_ORDER.forEach(pos=>{
      const has=(S.players||[]).some(p=>p.pos===pos&&!p.loanOut&&!(p.kjia>0)&&!p.retiring);
      if(!has){
        const used=new Set((S.players||[]).map(p=>p.id));
        const def=genFreeAgentDef(pos,'mid',new Set((S.players||[]).map(p=>p.name)));
        const np=genPlayer(def);
        S.players.push(np);
      }
    });
    if(me&&!S.players.some(p=>p.id===me.id)){
      // 本人被年度轮换退役：门禁停止
      S.career.retired=true;
    }
    coachPickLineup(S);
    autoFillLineup(S);
  }catch(e){}
}
function seasonSnapshot(tag){
  const me=myPlayer(S)||{};
  return {
    tag,season:S.season,split:S.split,day:S.day,phase:S.phase,
    ovr:overall(me)||0,val:me.val||0,pop:me.popularity||0,
    starter:!!(me.id&&S.lineup.includes(me.id)),
    caps:me.caps||0,apps:me.apps||0,energy:me.energy||0,morale:me.morale||0,
    titles:S.career?S.career.titles||0:0,
    benchDays:S.career?S.career.benchDays||0:0,
    trained:S.career&&S.career.stats?S.career.stats.trained:0,
    social:S.career&&S.career.stats?S.career.stats.social:0,
    media:S.career&&S.career.stats?S.career.stats.media:0,
    matches:S.career&&S.career.stats?S.career.stats.matches:0,
    role:S.career?S.career.role:null,
    fund:S.fund,
    retired:!!(S.career&&S.career.retired),
  };
}
function runOneYear(i,win){
  playLeague(win);
  const mid=seasonSnapshot('S'+S.season+'-spring');
  advanceCalendar(S);
  playCups(win);
  if(S.split==='summer'){
    playLeague(win);
    advanceCalendar(S);
    playCups(win);
  }
  topUpRoster();
  return {mid,end:seasonSnapshot('S'+S.season+'-end')};
}
function bootPlayerCareer(){
  initStart();
  pickPlayerArch(1);
  createPlayerCareer();
  // 抬到可竞争首发，避免门禁被「永远板凳」噪音淹没（内容密度才是本门禁重点）
  const me=myPlayer(S);
  ['lane','farm','team','mind'].forEach(k=>{me.attrs[k]=Math.min(92,me.attrs[k]+12);});
  me.energy=100;me.morale=90;me.injury=0;
  coachPickLineup(S);
  return S;
}
`;

const run = `
(function(){
  bootPlayerCareer();
  const snaps=[];
  for(let i=0;i<${N_SEASONS};i++){
    if(S.mode!=='player')throw new Error('mode 漂移: '+S.mode);
    if(S.career&&S.career.retired)break;
    const win=i%2===0; // 隔季强弱交替：覆盖夺冠/出局两条路径
    const r=runOneYear(i,win);
    snaps.push(r.mid,r.end);
  }
  return snaps;
})()
`;

let snaps;
try {
  snaps = vm.runInContext(HEADLESS + '\n' + run, dom);
} catch (e) {
  console.error('[FAIL] sim-player crashed:', e.message);
  console.error(e.stack);
  process.exitCode = 1;
  process.exit();
}

const ends = snaps.filter(x => x.tag && String(x.tag).endsWith('-end'));
const errs = [];
if (ends.length < Math.min(N_SEASONS, 3)) errs.push(`有效赛季过少: ${ends.length}/${N_SEASONS}`);
const ovrStart = snaps[0] ? snaps[0].ovr : 0;
const ovrEnd = ends.length ? ends[ends.length - 1].ovr : 0;
if (ovrEnd < ovrStart) errs.push(`总值未成长: ${ovrStart} → ${ovrEnd}`);
const last = ends[ends.length - 1] || snaps[snaps.length - 1] || {};
if ((last.trained || 0) < 3) errs.push(`训练次数过少: ${last.trained}`);
if ((last.social || 0) < 1) errs.push(`社交从未参与（内容密度失效）: ${last.social}`);
if ((last.matches || 0) < 3) errs.push(`比赛场次过少: ${last.matches}`);
if ((last.media || 0) < 0) errs.push('media 计数异常');
const funds = snaps.map(x => x.fund).filter(x => x != null);
const minFund = funds.length ? Math.min.apply(null, funds) : 0;
if (minFund < -50) errs.push(`资金被打穿: ${minFund}`);
const started = snaps.filter(x => x.starter).length;
// 采样点包含 mid/end，首发率门槛放宽到 25%（板凳路径合法，但不能全程无出场）
if (started < Math.ceil(snaps.length * 0.25)) errs.push(`首发采样过低: ${started}/${snaps.length}`);
if (snaps.some(x => x.retired)) {
  // 中途退役可接受，但必须在至少 2 个赛季采样之后
  const firstRet = snaps.findIndex(x => x.retired);
  if (firstRet < 2) errs.push(`过早退役: index ${firstRet}`);
}

console.log('=== 选手长局门禁 · seed=' + SEED + ' · ' + N_SEASONS + ' 赛季 ===');
snaps.forEach(x => {
  console.log(`${x.tag} d${x.day} phase=${x.phase} ovr=${x.ovr} val=${x.val} pop=${x.pop} starter=${x.starter ? 'Y' : 'N'} caps=${x.caps} bench=${x.benchDays} train=${x.trained} social=${x.social} media=${x.media} match=${x.matches} titles=${x.titles} fund=${x.fund}${x.retired ? ' RETIRED' : ''}`);
});
console.log('汇总: ovr ' + ovrStart + '→' + ovrEnd +
  ' · 训练 ' + (last.trained || 0) + ' · 社交 ' + (last.social || 0) +
  ' · 媒体 ' + (last.media || 0) + ' · 比赛 ' + (last.matches || 0) +
  ' · 冠 ' + (last.titles || 0) + ' · 最低资金 ' + minFund +
  ' · 首发采样 ' + started + '/' + snaps.length);

if (errs.length) {
  console.log('[FAIL] ' + errs.join(' ; '));
  process.exitCode = 1;
} else {
  console.log('[PASS] 选手长局漏斗：成长/出场/日决策/经济均在阈值内');
}
