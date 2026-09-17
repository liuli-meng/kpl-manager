// 年总总决赛打完后是否自动年度轮换（截图症状：圣龙杯已出、仍停在第52天夏季）
const vm = require('vm');
const { makeDom, injectHelpers } = require('./harness');

const { dom } = makeDom();
injectHelpers(dom);

const out = vm.runInContext(`
(function(){
  const res=[],errs=[];
  const log=t=>res.push(t);
  const fail=m=>errs.push(m);

  function closeSeries(win){
    if(!S.series)return false;
    S.series.mw=win?Math.ceil(S.series.max/2):1;
    S.series.ow=win?1:Math.ceil(S.series.max/2);
    finishSeries(win);
    return true;
  }
  function runLeagueQuick(){
    let g=0;
    while(!['champion','eliminated'].includes(S.phase)&&g++<220){
      if(S.preseason){S.preseason=false;S.transferWindow=0;continue;}
      if(S.phase==='r1'||S.phase==='r2'||S.phase==='r3'){
        if(S.matchIdx>=(S.schedule||[]).length){advancePhase(S);continue;}
        if(S.series&&S.series.stage==='regular'){closeSeries(true);continue;}
        const m=S.schedule[S.matchIdx];
        S.series={used:[],usedOpp:[],mw:0,ow:0,max:5,stage:'regular',logs:[],myName:S.teamName,opName:m.opp,side:'blue'};
        S.series.mw=3;S.series.ow=1;finishSeries(true);
      }else if(S.phase==='card'){
        if(S.series){closeSeries(true);continue;}
        const myCard=S.card&&S.card.matches.find(x=>!x.r&&(x.a===S.teamName||x.b===S.teamName));
        if(!myCard){startCard();continue;}
        S.series={used:[],usedOpp:[],mw:0,ow:0,max:7,stage:'card',cardMatch:myCard,logs:[],myName:S.teamName,opName:myCard.a===S.teamName?myCard.b:myCard.a,side:'blue'};
        S.series.mw=4;S.series.ow=1;finishSeries(true);
      }else if(S.phase==='playoff'){
        if(S.series){closeSeries(true);continue;}
        startPlayoff();
        if(!S.series)break;
      }else break;
    }
  }
  function clubHtml(){
    renderClub();
    return document.getElementById('page-club').innerHTML||'';
  }
  function prepToAnnualFinal(){
    // 强队打进年总，再强制把淘汰赛推到「只剩总决赛未打、且我队在决赛」
    S=newState('年终轮换探针','⚔');
    fillRoster(S,'star');
    S.coach={...COACH_POOL.find(c=>c.id==='co12')};
    S.lineup=S.players.map(p=>p.id);
    S.seedPower=teamPower(S);
    startSplit(S,'spring');
    S.preseason=false;S.transferWindow=0;
    runLeagueQuick();
    advanceCalendar(S);
    let g=0;
    while((S.phase==='challenger'||S.phase==='ewc')&&g++<120){
      if(S.series){closeSeries(true);continue;}
      if(S.phase==='challenger'&&S.challenger&&!S.challenger.champ){startCup(S);if(S.series){closeSeries(true);continue;}}
      else if(S.phase==='ewc'&&S.ewc&&!S.ewc.champ){startCup(S);if(S.series){closeSeries(true);continue;}}
      else break;
      if(S.phase==='summer'||S.preseason)break;
    }
    if(S.preseason){S.preseason=false;S.transferWindow=0;}
    if(S.split==='summer'){
      runLeagueQuick();
      advanceCalendar(S);
      let a=0;
      while(S.phase==='asiad'&&!(S.ag&&S.ag.champ)&&a++<20)asiadStep(S);
    }
    if(S.phase!=='annual'){
      S.annualPts[S.teamName]=999;
      setupAnnual(S);
    }
    // 推进到 po，且确保我队在总决赛
    let a=0;
    while(S.phase==='annual'&&S.annual&&S.annual.stage!=='po'&&a++<40){
      if(S.series){closeSeries(true);continue;}
      startCup(S);
      if(S.series){closeSeries(true);continue;}
    }
    if(S.phase!=='annual'||!S.annual||S.annual.stage!=='po'){
      fail('未能到达年总淘汰赛 phase='+S.phase+' stage='+(S.annual&&S.annual.stage));
      return false;
    }
    // 强制构造：我队打进总决赛（直接写 bracket）
    const p=S.annual.po;
    const me=S.teamName, opp='武汉eStarPro';
    // 抹掉其他场次，只留总决赛双方
    p.wb1=[{a:me,b:'X1',r:me,ms:4,es:0},{a:'X2',b:'X3',r:'X2',ms:4,es:1},{a:opp,b:'Y1',r:opp,ms:4,es:0},{a:'Y2',b:'Y3',r:'Y2',ms:4,es:2}];
    p.wb2=[{a:me,b:'X2',r:me,ms:4,es:1},{a:opp,b:'Y2',r:opp,ms:4,es:0}];
    p.wf={a:me,b:opp,r:me,ms:4,es:2};
    p.lb1=[{a:'X1',b:'Y1',r:'Y1',ms:4,es:3},{a:'X3',b:'Y3',r:'X3',ms:4,es:1}];
    p.lb2=[{a:'X2',b:'Y1',r:'Y1',ms:4,es:2},{a:'Y2',b:'X3',r:'Y2',ms:4,es:0}];
    p.lbs={a:'Y1',b:'Y2',r:'Y1',ms:4,es:3};
    p.lbf={a:opp,b:'Y1',r:opp,ms:4,es:1};
    p.final={a:me,b:opp,r:null,ms:null,es:null};
    p.champ=null;
    log('① 构造总决赛：'+me+' vs '+opp+' phase='+S.phase+' day='+S.day+' season='+S.season+' split='+S.split);
    return true;
  }

  // A. 玩家赢下总决赛 → 必须自动 newSeason
  if(!prepToAnnualFinal())return summarize();
  const seasonA=S.season, dayA=S.day, splitA=S.split;
  // 模拟玩家打完总决赛（走 finishSeries 真实路径）
  const mFinal=S.annual.po.final;
  tagMatch(S,mFinal,'apo_final');
  S.series={used:[],usedOpp:[],mw:0,ow:0,max:7,stage:'cup',mid:'apo_final',cupSlot:'apo_final',cupLabel:'年总·总决赛',logs:[],myName:S.teamName,opName:'武汉eStarPro',side:'blue'};
  S.series.mw=4;S.series.ow=1;
  let errA=null;
  try{finishSeries(true);}catch(e){errA=e;}
  if(errA)fail('A finishSeries 抛错: '+errA.message+' | '+(errA.stack||'').split('\\n')[1]);
  log('A 赢决赛后: phase='+S.phase+' season='+S.season+' day='+S.day+' split='+S.split
    +' champ='+(S.annual&&S.annual.po&&S.annual.po.champ)
    +' preseason='+S.preseason+' phaseName='+(typeof PHASE_NAME!=='undefined'?PHASE_NAME[S.phase]:S.phase));
  if(errA)return summarize();
  if(S.annual&&S.annual.po&&S.annual.po.champ!==S.teamName)fail('A 冠军不是我队 champ='+S.annual.po.champ);
  // 关键断言：必须已完成年度轮换（season+1 且 spring）
  if(S.season===seasonA)fail('A 未进新赛季 season 仍='+S.season+'（finishAnnual→newSeason 未完成）');
  if(S.split!=='spring')fail('A 新赛季不是春季 split='+S.split);
  if(S.day!==1)fail('A day 未重置为1 day='+S.day);
  if(S.phase==='annual')fail('A phase 仍停在 annual（截图症状）');
  if(S.preseason!==true&&S.mode==='manager')log('A 非转会期开局（mode='+S.mode+' preseason='+S.preseason+'）——经理模式通常应有转会期');
  else log('A 年度轮换 OK（season='+S.season+' split='+S.split+' day='+S.day+' phase='+S.phase+'）');

  // B. 玩家输掉总决赛（截图：AG vs eStarPro，eStarPro 夺冠）→ 同样必须轮换
  if(!prepToAnnualFinal())return summarize();
  const seasonB=S.season;
  const mB=S.annual.po.final;
  tagMatch(S,mB,'apo_final');
  S.series={used:[],usedOpp:[],mw:0,ow:0,max:7,stage:'cup',mid:'apo_final',cupSlot:'apo_final',cupLabel:'年总·总决赛',logs:[],myName:S.teamName,opName:'武汉eStarPro',side:'blue'};
  S.series.mw=1;S.series.ow=4;
  let errB=null;
  try{finishSeries(false);}catch(e){errB=e;}
  if(errB)fail('B finishSeries 抛错: '+errB.message+' | '+(errB.stack||'').split('\\n')[1]);
  log('B 输决赛后: phase='+S.phase+' season='+S.season+' day='+S.day+' split='+S.split
    +' champ='+(S.annual&&S.annual.po&&S.annual.po.champ)
    +' trained='+S.trained);
  if(errB)return summarize();
  if(S.annual&&S.annual.po&&S.annual.po.champ==='武汉eStarPro')log('B 冠军 eStarPro OK');
  else fail('B 冠军异常 champ='+(S.annual&&S.annual.po&&S.annual.po.champ));
  if(S.season===seasonB)fail('B 未进新赛季 season 仍='+S.season+'（截图症状复现）');
  if(S.split!=='spring')fail('B 新赛季不是春季 split='+S.split);
  if(S.phase==='annual')fail('B phase 仍停在 annual');
  else log('B 年度轮换 OK（season='+S.season+' split='+S.split+' day='+S.day+' phase='+S.phase+'）');

  // C. 再点一次 startCup（残留 annual + champ）不应卡死
  // 在 B 的基础上若已轮换则跳过；否则强制再验
  if(S.phase==='annual'&&S.annual&&S.annual.po&&S.annual.po.champ){
    try{startCup(S);log('C champ 后 startCup phase='+S.phase+' season='+S.season);}
    catch(e){fail('C champ 后 startCup 抛错: '+e.message);}
    if(S.phase==='annual'&&S.season===seasonB)fail('C champ 后点按钮仍未轮换');
  }else log('C 已离开 annual，跳过残留点击');

  // D. 构造卡死存档：champ 已写入、phase 仍 annual、day 仍夏季末（用户截图症状）
  if(!prepToAnnualFinal())return summarize();
  const pD=S.annual.po;
  pD.final.r=S.teamName;pD.final.ms=4;pD.final.es=1;
  pD.champ=S.teamName; // 颁奖已写 champ
  S.phase='annual';S.split='summer';S.day=52; // 模拟 newSeason 未跑完
  S.season=1;
  const htmlD=clubHtml();
  if(htmlD.indexOf('uiFinishAnnual')<0)fail('D 卡死态无 uiFinishAnnual 恢复按钮');
  else log('D 卡死态 UI 有 uiFinishAnnual OK');
  const actD=nextAction(S);
  if(!actD||actD.fn!=='uiFinishAnnual')fail('D 卡死态 nextAction='+(actD&&actD.fn)+'（应为 uiFinishAnnual）');
  else log('D nextAction=uiFinishAnnual OK');
  let errD=null;
  try{finishAnnual(S,true);}catch(e){errD=e;}
  if(errD)fail('D finishAnnual 抛错: '+errD.message);
  if(S.season!==2||S.split!=='spring'||S.phase==='annual')
    fail('D 未完成轮换 season='+S.season+' split='+S.split+' phase='+S.phase+' day='+S.day);
  else log('D 卡死态恢复 OK（season='+S.season+' split='+S.split+' phase='+S.phase+'）');
  const seasonD=S.season, agesD=(S.players||[]).map(p=>p.age).join();
  try{finishAnnual(S,true);}catch(e){fail('D 二次 finishAnnual 抛错: '+e.message);}
  if(S.season!==seasonD)fail('D 二次调用又加了一季 season='+S.season);
  if(agesD!==(S.players||[]).map(p=>p.age).join())fail('D 二次调用又长了一岁');
  else log('D 幂等 OK（不重复轮换）');

  return summarize();
  function summarize(){
    return (errs.length?errs.map(e=>'[FAIL] '+e).join('\\n')+'\\n':'') + res.map(r=>'[INFO] '+r).join('\\n') + (errs.length?'\\n共 '+errs.length+' 失败':'\\n全部通过');
  }
})()
`, dom);

console.log(out);
if (/\[FAIL\]/.test(out)) process.exitCode = 1;
