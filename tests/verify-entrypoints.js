// 全赛段入口审计：把一整年流程推到底，每进入一个新阶段/中盘态就断言俱乐部页有可点的比赛入口。
// 起因：年总淘汰赛按钮条件曾误写成「总决赛双方确定才显示」，导致前半程只显示赛程打不了——
// 这类「面板渲染了、入口没渲染」的死角引擎测试测不出来，必须断言渲染产物。
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};let hadFail=false;
  const log=t=>res.push('[INFO] '+t);
  // 入口断言：渲染俱乐部页，检查指定 onclick 处理函数出现在 HTML 里
  const checked={};
  const checkEntry=(label,needle)=>{
    renderClub();
    const html=document.getElementById('page-club').innerHTML;
    if(html.indexOf(needle)<0){fail(label+'：俱乐部页缺比赛入口（未渲染 '+needle+'）');}
    else{checked[label]=true;log(label+'：入口 '+needle+' OK');}
  };
  try{
    // ===== 开局 =====
    S=newState('测试队','⚔️');
    fillRoster(S,'star');
    S.coach={...COACH_POOL.find(c=>c.id==='co12')};
    S.lineup=S.players.map(p=>p.id);
    S.seedPower=teamPower(S);
    startSplit(S,'spring');
    S.preseason=false;S.transferWindow=0;S.day=10;
    // 快进工具：系列赛按 3:1（BO5）/4:1（BO7）收官
    const closeSeries=()=>{if(S.series){S.series.mw=Math.ceil(S.series.max/2);S.series.ow=1;finishSeries(true);return true;}return false;};
    // 常规赛入口：转会期（preseason）时是「结束转会期」面板，开赛后才是「下一场比赛」
    const leagueEntry=()=>checkEntry(S.preseason?'转会期（'+(S.split==='summer'?'夏季赛':'春季赛')+'）':'常规赛开幕',S.preseason?'uiEndPreseason':'uiStartMatch');
    leagueEntry();
    let cardUiChecked=false,poUiChecked=false;
    const runLeague=()=>{
      let g=0;
      while(!['champion','eliminated'].includes(S.phase)&&g++<200){
        if(S.preseason){S.preseason=false;S.transferWindow=0;continue;}
        if(S.phase==='r1'||S.phase==='r2'||S.phase==='r3'){
          if(S.matchIdx>=S.schedule.length){advancePhase(S);continue;}
          if(S.series){closeSeries();continue;}
          const m=S.schedule[S.matchIdx];
          S.series={used:[],usedOpp:[],mw:0,ow:0,max:5,stage:'regular',logs:[],myName:S.teamName,opName:m.opp,side:'blue'};
          S.series.mw=3;S.series.ow=1;finishSeries(true);
        }else if(S.phase==='card'){
          if(!cardUiChecked){cardUiChecked=true;checkEntry('卡位赛','startCard');}
          if(S.series){closeSeries();continue;}
          const myCard=S.card&&S.card.matches.find(x=>!x.r&&(x.a===S.teamName||x.b===S.teamName));
          if(!myCard){startCard();continue;}
          S.series={used:[],usedOpp:[],mw:0,ow:0,max:7,stage:'card',cardMatch:myCard,logs:[],myName:S.teamName,opName:myCard.a===S.teamName?myCard.b:myCard.a,side:'blue'};
          S.series.mw=4;S.series.ow=1;finishSeries(true);
        }else if(S.phase==='playoff'){
          if(!poUiChecked){poUiChecked=true;checkEntry('季后赛开幕','startPlayoff');}
          if(S.series){closeSeries();continue;}
          startPlayoff();
          if(!S.series)break;
        }else break;
      }
    };
    runLeague();
    if(S.phase!=='champion'&&S.phase!=='eliminated')fail('春季赛未正常收官: phase='+S.phase);
    checkEntry(S.phase==='champion'?'春季冠军收官':'春季止步收官','uiAdvanceCalendar');
    // ===== 挑战者杯（32强单败 → 8强双败 → 决赛 BO9）=====
    advanceCalendar(S);
    if(S.phase!=='challenger')fail('春季赛后未进入挑战者杯: phase='+S.phase);
    checkEntry('挑战者杯开幕','uiStartCup');
    let cbPoOpen=false,cbPoMid=false;
    let g1=0;
    while(S.phase==='challenger'&&g1++<80){
      const c=S.challenger;
      if(c.po&&!cbPoOpen){cbPoOpen=true;checkEntry('挑战者杯8强双败开幕','uiStartCup');}
      if(c.po&&c.po.wb1[0].r&&!c.po.champ&&!cbPoMid){cbPoMid=true;checkEntry('挑战者杯8强双败中盘','uiStartCup');}
      if(S.series){closeSeries();continue;}
      const mySingle=[...c.r1,...(c.r2||[])].some(m=>!m.r&&(m.a===S.teamName||m.b===S.teamName));
      const myPo=c.po&&!c.final&&[...c.po.wb1,...c.po.lb1,...c.po.wb2,...c.po.lb2,c.po.wf,c.po.lbs,c.po.lbf].some(m=>!m.r&&(m.a===S.teamName||m.b===S.teamName));
      const myFinal=c.final&&!c.final.r&&(c.final.a===S.teamName||c.final.b===S.teamName);
      if(!mySingle&&!myPo&&!myFinal){
        if(!c.champ&&!(c.final&&!c.final.r))startCup(S);
        if(!S.series&&!c.champ&&!(c.final&&!c.final.r))break;
        if(!S.series)break;
        continue;
      }
      startCup(S);
      if(!S.series&&!c.champ)break;
    }
    if(!S.challenger.champ)fail('挑战者杯未产生冠军');
    // ===== EWC（8强单败）=====
    let g2=0;
    while(S.phase==='ewc'&&g2++<40){
      const e=S.ewc;
      if(!checked['EWC开幕'])checkEntry('EWC开幕','uiStartCup');
      if(e.qf.every(m=>m.r)&&!e.champ&&!checked['EWC中盘'])checkEntry('EWC中盘','uiStartCup');
      if(S.series){closeSeries();continue;}
      const myPending=[...e.qf,...e.sf,e.final].some(m=>!m.r&&(m.a===S.teamName||m.b===S.teamName));
      if(!myPending)break;
      startCup(S);
      if(!S.series&&!S.ewc.champ)break;
    }
    if(!S.ewc||!S.ewc.champ)fail('EWC 未产生冠军');
    if(S.split!=='summer')fail('挑战者杯/EWC 后未进入夏季赛: split='+S.split);
    // ===== 夏季赛 =====
    leagueEntry();
    cardUiChecked=false;poUiChecked=false;
    runLeague();
    if(S.phase!=='champion'&&S.phase!=='eliminated')fail('夏季赛未正常收官: phase='+S.phase);
    checkEntry(S.phase==='champion'?'夏季冠军收官':'夏季止步收官','uiAdvanceCalendar');
    // ===== 亚运年：亚运会（玩家放人观赛，只断言推进按钮）=====
    advanceCalendar(S);
    if(isAsiadYear(S)){
      if(S.phase!=='asiad')fail('亚运年夏季赛后应进入亚运会: phase='+S.phase);
      checkEntry('亚运会','uiAsiadStep');
      let ag=0;
      while(S.phase==='asiad'&&!S.ag.champ&&ag++<20)asiadStep(S);
      if(!S.ag.champ)fail('亚运会未产生冠军');
      log('亚运会收官: '+S.ag.medal);
    }
    // ===== 年度总决赛 =====
    if(S.phase!=='annual')fail('夏季赛后未进入年总: phase='+S.phase);
    const stageOpen={arena:'年总擂台赛开幕',breakthrough:'年总突围赛开幕',po:'年总淘汰赛开幕'};
    const stageMid={po:'年总淘汰赛中盘'};
    let poMidChecked=false;
    let g3=0;
    while(S.phase==='annual'&&g3++<120){
      const a=S.annual;
      if(a.stage==='po'&&a.po){
        if(!checked[stageOpen.po]){checkEntry(stageOpen.po,'uiStartCup');}
        if(a.po.wb1[0].r&&!a.po.champ&&!poMidChecked){poMidChecked=true;checkEntry(stageMid.po,'uiStartCup');}
      }else if(!checked[stageOpen[a.stage]]){
        checkEntry(stageOpen[a.stage],'uiStartCup'); // arena/breakthrough：面板有对阵就必须有入口
      }
      if(S.series){closeSeries();continue;}
      if(a.stage==='arena'&&a.roundIdx<6){startCup(S);if(!S.series)break;continue;}
      if(!S.series&&!a.po)break;
      startCup(S);
      if(!S.series&&a.stage==='po'&&a.po.champ)break;
      if(!S.series&&a.stage==='breakthrough'&&a.brk.every(m=>m.r))continue;
      if(!S.series)break;
    }
    if(!S.annual||!S.annual.po||!S.annual.po.champ)fail('年总未产生冠军: stage='+(S.annual&&S.annual.stage));
    // ===== 年度轮换回到下一年春季赛：入口状态完好 =====
    if(S.phase!=='r1')fail('年总后未年度轮换: phase='+S.phase);
    leagueEntry();
    // ===== 构造态审计：不依赖推进路径的确定性死角覆盖 =====
    // 卡位赛：我队在 S5 位待打
    S.phase='card';
    S.card={matches:[{a:S.teamName,b:'广州TTG',r:null,winTo:'S'},{a:'重庆狼队',b:'武汉eStarPro',r:null,winTo:'S'},{a:'佛山DRG',b:'北京WB',r:null,winTo:'A'},{a:'成都AG超玩会',b:'深圳DYG',r:null,winTo:'A'}],idx:0};
    checkEntry('卡位赛（构造：我队待打）','startCard');
    // 卡位赛：我队已打完（r 已定）但引擎同步推进不停留——若停留属 bug，此时无按钮属预期，不设断言
    // 年总淘汰赛中盘：wb1 打完（我队胜者组晋级）、wb2/lb 待定——修复 bug 的核心场景
    const eight2=['测试队','广州TTG','武汉eStarPro','佛山DRG','重庆狼队','成都AG超玩会','北京WB','深圳DYG'];
    const midPo=buildCup8(eight2);
    midPo.wb1.forEach((m,i)=>{m.r=m.a;}); // 四场全定（胜者晋级）
    midPo.lb1[0].a=midPo.wb1[0].b;midPo.lb1[0].b=midPo.wb1[1].b; // 败者组已落位待打
    S.phase='annual';
    S.annual={stage:'po',po:midPo,mRank:[],eRank:[]};
    checkEntry('年总淘汰赛中盘（构造：败者组待打）','uiStartCup');
    // 我队双败出局后的残局：只剩 AI 场次，必须还有「快进赛程」入口
    const outPo=buildCup8(eight2);
    outPo.wb1[0].r='广州TTG';outPo.wb1[0].ms=4;outPo.wb1[0].es=1; // 我队首轮出局（败者组还有一场）
    outPo.lb1[0].a='测试队';outPo.lb1[0].b='深圳DYG';
    S.annual={stage:'po',po:outPo,mRank:[],eRank:[]};
    checkEntry('年总淘汰赛残局（构造：我队败者组待打）','uiStartCup');
    log('全赛段入口审计完成：覆盖 常规赛×2/卡位赛/季后赛/收官页×2/挑战者杯×3/EWC×2/亚运/年总×4/新一年');
    if(!hadFail)res.push('[PASS] 全赛段入口审计通过');
  }catch(e){res.push('[FAIL] 异常: '+e.message+'\\n'+(e.stack||'').split('\\n').slice(0,3).join('\\n'));hadFail=true;}
  res.push(hadFail?'RESULT-FAIL':'RESULT-PASS');
  return res.join('\\n');
})()
`, dom);

console.log(out);
if (out.indexOf('RESULT-PASS') < 0) process.exitCode = 1;
