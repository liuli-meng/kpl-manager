// 教练长局门禁：带队成绩 + 执教生涯去留 + 俱乐部自动运转
// 对照 docs/教练平衡探针清单.md：A1/A2 + B1/B2 + C1 + D2
// 区间校准：种子 999983 n=30 与种子 42 n=50（AG 夺冠 76%~87% · UUG 季后赛 50%~57%）
// 运行：node tests/sim-coach.js [--n=50] [--seed=<int|random>]
const vm = require('vm');
const { makeDom, injectHelpers } = require('./harness');

const argv = process.argv.slice(2);
const N_SEASONS = Math.max(3, parseInt((argv.find(a => a.startsWith('--n=')) || '').split('=')[1], 10) || 50);
const seedArg = (argv.find(a => a.startsWith('--seed=')) || '').split('=')[1];
const RANDOM_SEED = seedArg === 'random';
const SEED = RANDOM_SEED ? (Date.now() % 1000000) : (parseInt(seedArg, 10) || 424243);

const { dom } = makeDom();
injectHelpers(dom);
vm.runInContext(`Math.random=(function(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};})(${SEED});`, dom);

const script = `
(function(){
  const N=${N_SEASONS};
  const res=[];
  const fail=function(m){res.push('[FAIL] '+m);};
  const ok=function(t){res.push('[PASS] '+t);};

  function simCoachSquad(tmplName){
    const t=CLUB_TEMPLATES.find(function(c){return c.name===tmplName;});
    if(!t)throw new Error('模板缺失: '+tmplName);
    S=newState(t.name,'⚔️');
    S.mode='coach';
    t.players.forEach(function(pid){
      const def=PLAYER_POOL.find(function(d){return d.id===pid;});
      if(def)S.players.push(genPlayer(def));
    });
    S.coach=Object.assign({},COACH_POOL.find(function(c){return c.id===t.coach;}));
    S.lineup=S.players.map(function(p){return p.id;});
    S.fund=t.budget;
    S.wageCap=t.cap;
    S.coachDeal={years:2,honors:[],log:[]};
    S.board={trust:60,kpi:null,warn:0,fired:false,firedSeason:0,log:[]};
    // 每位置补替补：无替补伤停会卡死自动 BP
    const usedB=new Set(S.players.map(function(p){return p.name;}));
    POS_ORDER.forEach(function(pos){
      if(S.players.some(function(p){return p.pos===pos&&!S.lineup.includes(p.id);}))return;
      S.players.push(genPlayer(genFreeAgentDef(pos,'low',usedB)));
    });
    S.seedPower=teamPower(S);
    initGroups(S);
    S.preseason=false;
    S.transferWindow=0;
    return S;
  }

  function driveOne(){
    let guard=0;
    while(!['champion','eliminated'].includes(S.phase)&&guard++<400){
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
  }

  function rosterFull(){
    return POS_ORDER.every(function(pos){
      return (S.players||[]).some(function(p){return p.pos===pos&&!p.loanOut&&!(p.kjia>0)&&!p.retiring;});
    });
  }

  function runTier(label,tmpl,pred){
    let po=0,champ=0,fired=0,fullOk=0,trustSum=0,yearsSum=0,modeBad=0;
    for(let k=0;k<N;k++){
      simCoachSquad(tmpl);
      try{coachAutoSquad(S);}catch(e){}
      try{autoFillLineup(S);}catch(e){}
      driveOne();
      const pf=S.playoff||{};
      const touched=['playoff','champion'].includes(S.phase)||
        [pf.wb,pf.lb,pf.lb2,pf.lb3,[pf.wf,pf.lb4,pf.lbf,pf.final]].flat().filter(Boolean)
          .some(function(m){return m&&(m.a===S.teamName||m.b===S.teamName||m.r===S.teamName);});
      const isChamp=(pf.final&&pf.final.r===S.teamName)||(S.champion===true&&S.phase==='champion');
      if(touched)po++;
      if(isChamp)champ++;
      try{
        if(typeof setBoardKpi==='function')setBoardKpi(S);
        if(typeof boardSettle==='function')boardSettle(S);
      }catch(e){}
      if(S.board&&S.board.fired)fired++;
      trustSum+=(S.board&&S.board.trust!=null)?S.board.trust:60;
      yearsSum+=(S.coachDeal&&typeof S.coachDeal.years==='number')?S.coachDeal.years:0;
      if(S.coachDeal)S.coachDeal.years=Math.max(0,(S.coachDeal.years||0)-1);
      if(rosterFull())fullOk++;
      if(S.mode!=='coach')modeBad++;
    }
    const r={po:po/N,champ:champ/N,fired:fired/N,full:fullOk/N,trust:Math.round(trustSum/N),years:Math.round(yearsSum/N*10)/10,modeBad:modeBad};
    const bad=pred(r);
    if(bad)fail(label+' '+bad);
    else ok(label+' 季后赛 '+(r.po*100).toFixed(0)+'% · 夺冠 '+(r.champ*100).toFixed(0)+'% · 解约 '+(r.fired*100).toFixed(0)+'% · 末信任 '+r.trust+' · 合同年余 '+r.years+' · 阵容齐 '+(r.full*100).toFixed(0)+'%');
  }

  // 区间按 n=30/50 两种子实测（999983/42）设；n<20 只钉结构（小样本率值噪声大）
  const tight = N>=20;
  runTier('AG豪门','成都AG超玩会',function(r){
    if(r.modeBad)return 'mode 漂移 '+r.modeBad;
    if(r.full<1)return '阵容不完整';
    if(r.fired>0.5)return '解约率过高 '+(r.fired*100).toFixed(0)+'%';
    if(!tight)return null;
    if(r.po<0.75)return 'AG 季后赛率过低 '+(r.po*100).toFixed(0)+'%';
    if(r.champ<0.4||r.champ>0.92)return 'AG 夺冠率越界 '+(r.champ*100).toFixed(0)+'%（基线 ~70%~85%）';
    return null;
  });
  runTier('中游队','苏州KSG',function(r){
    if(r.modeBad)return 'mode 漂移 '+r.modeBad;
    if(r.full<1)return '阵容不完整';
    if(r.fired>0.5)return '解约率过高';
    if(!tight)return null;
    if(r.po<0.2||r.po>0.85)return '中游季后赛率越界 '+(r.po*100).toFixed(0)+'%';
    return null;
  });
  runTier('UUG弱旅','常山UUG',function(r){
    if(r.modeBad)return 'mode 漂移 '+r.modeBad;
    if(r.full<1)return '阵容不完整';
    if(r.fired>0.6)return '解约率过高 '+(r.fired*100).toFixed(0)+'%';
    if(!tight)return null;
    if(r.po>0.8)return 'UUG 季后赛率过高 '+(r.po*100).toFixed(0)+'%';
    if(r.po<0.15)return 'UUG 季后赛率过低 '+(r.po*100).toFixed(0)+'%';
    return null;
  });

  return res.join('\\n');
})()
`;

const result = vm.runInContext(script, dom);
console.log('=== 教练长局门禁（P0）· seed=' + SEED + ' · ' + N_SEASONS + ' 赛季/档 ===');
console.log(result);
if (String(result).includes('[FAIL]')) process.exit(1);
console.log('[PASS] 教练长局漏斗：成绩/去留/阵容均在阈值内');
