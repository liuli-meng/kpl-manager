// 平衡性蒙特卡洛：无头跑完整赛季（真实三档开局），统计进季后赛率/夺冠率/资金
const vm = require('vm');
// DOM 桩 / 源模块清单 / 沙箱辅助统一由 harness 提供（只维护一份）
const { makeDom, injectHelpers } = require('./harness');
const { dom } = makeDom();
injectHelpers(dom);

const HEADLESS = `
function simSquad(kind){
  S=newState(kind.name,'⚔️');
  if(kind.template){
    const tmpl=CLUB_TEMPLATES.find(c=>c.name===kind.template);
    tmpl.players.forEach(pid=>{const def=PLAYER_POOL.find(d=>d.id===pid);if(def)S.players.push(genPlayer(def));});
    S.coach={...COACH_POOL.find(c=>c.id===tmpl.coach)};
    S.lineup=S.players.map(p=>p.id);
  }else{
    fillRoster(S,'mid','star');
    S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  }
  S.seedPower=teamPower(S);
  initGroups(S);
  S.preseason=false;S.transferWindow=0;
  return S;
}
function simSeason(kind){
  simSquad(kind);
  const myPow=teamPower(S);
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
  return {myPow,phase:S.phase,champ:S.phase==='champion'&&S.champion,po:['playoff','champion'].includes(S.phase),minFund:Math.min.apply(null,minFund),broke};
}
function runBatch(kind,n){
  let po=0,champ=0,elim=0,broke=0,minF=1e9,powSum=0;
  for(let i=0;i<n;i++){
    const r=simSeason(kind);
    if(r.po)po++;if(r.champ)champ++;if(r.phase==='eliminated')elim++;if(r.minFund<=0)broke++;
    powSum+=r.myPow;
    if(r.minFund<minF)minF=r.minFund;
  }
  return {name:kind.name,po,champ,elim,broke,minF,avgPow:Math.round(powSum/n)};
}
function scaleProbe(){
  S=newState('探针','⚔️');
  S.lineup=[];S.players=[];
  const ag=ensureAiRosters(S,'成都AG超玩会'),uug=ensureAiRosters(S,'常山UUG'),ksg=ensureAiRosters(S,'苏州KSG');
  return 'AI刻度: AG='+aiRosterPower(ag)+' KSG='+aiRosterPower(ksg)+' UUG='+aiRosterPower(uug);
}
`;

const N = 200;
console.log(vm.runInContext(HEADLESS + 'scaleProbe()', dom));
console.log('=== 蒙特卡洛 ×'+N+'（真实三档开局，种子=真实战力）===');
console.log('开局       均战力  进季后赛  夺冠   止步   破产   最低资金');
const kinds = [
  {name:'自建新队', template:null},
  {name:'AG豪门', template:'成都AG超玩会'},
  {name:'UUG弱旅', template:'常山UUG'},
];
kinds.forEach(k=>{
  const r = JSON.parse(vm.runInContext(HEADLESS + 'JSON.stringify(runBatch('+JSON.stringify(k)+','+N+'))', dom));
  console.log(r.name.padEnd(9), String(r.avgPow).padEnd(6), (r.po/N*100+'%').padEnd(8), (r.champ/N*100+'%').padEnd(5), (r.elim/N*100+'%').padEnd(6), (r.broke/N*100+'%').padEnd(6), r.minF);
});
