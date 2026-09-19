const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();
const seed = 126511990;
vm.runInContext('this.Math=(function(a){var f=function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};var M=Object.create(Math);M.random=f;return M;})(' + seed + ')', dom);
const out = vm.runInContext(`(function(){
const hits=[];
function badFund(tag){
  if(S&&typeof S.fund==='number'&&isNaN(S.fund))hits.push({tag,season:S.season,day:S.day,phase:S.phase,hosts:(S.hosts||[]).map(h=>({n:h.name,inc:h.income,t:typeof h.income}))});
}
// 包装所有可能改 fund 的入口
const wrap=(name,fn)=>function(){
  const before=S&&S.fund;
  try{
    return fn.apply(this,arguments);
  }finally{
    const after=S&&S.fund;
    const wasBad=typeof before!=='number'||isNaN(before);
    const nowBad=typeof after!=='number'||isNaN(after);
    if(nowBad&&!wasBad){
      hits.push({fn:name,before,after,arg0:arguments[0]&&(arguments[0].id||arguments[0].name||arguments[0].teamName||typeof arguments[0]),arg1:arguments[1]});
    }
  }
};
['negoComplete','buyPlayer','signFreeAgent','loanPlayer','sellAcceptClub','recruitRookie','openSellNego','nextDay','newSeason','endPreseason','refreshMarket','buildTransferMarket','doTrain','doRest','payWages','finishSeries','autoPlayNext','startMatch','finishAnnual',
 'signRetired','hireAssistant','fireAssistant','upgradeSponsor'].forEach(n=>{
  if(typeof this[n]==='function')this[n]=wrap(n,this[n]);
});
// 名宿/助教/赞助这条花钱链上任何一处 cost 是 undefined，资金立刻变 NaN（历史 bug：AI 旧帅回流没价码）
function unpriced(){
  const bad=[];
  (S.retiredCoaches||[]).forEach(r=>{if(r&&r.type!=='host'&&!(r.cost>0&&r.wage>0))bad.push('rc:'+r.name+'/'+r.cost+'/'+r.wage);});
  (S.assistants||[]).forEach(a=>{if(a&&!(a.cost>0&&a.wage>0))bad.push('as:'+a.name+'/'+a.cost+'/'+a.wage);});
  if(S.coach&&!(S.coach.wage>0))bad.push('coach:'+S.coach.name);
  return bad;
}

const pickOne=a=>a[Math.floor(Math.random()*a.length)];
S=newState('压测队','⚔️');
fillRoster(S,'mid');
S.coach={...COACH_POOL.find(c=>c.id==='co12')};
S.seedPower=400;initGroups(S);
S.preseason=true;S.transferWindow=7;buildTransferMarket(S);refreshMarket(S);
function playSeries(){
  if(S.preseason){endPreseason(S);if(S.preseason)return false;}
  const ph=S.phase;
  if(ph==='r1'||ph==='r2'||ph==='r3')startMatch();
  else if(ph==='card')startCard();
  else if(ph==='playoff')startPlayoff();
  if(!S.series)return false;
  let g=0;
  while(S.series&&g++<15)autoPlayNext();
  if(S.series)S.series=null;
  return true;
}
function daily(){
  const a=pickOne(['day','train','rest','rest','rest']);
  if(a==='day')nextDay(S);
  else if(a==='train'&&S.players.length){const p=pickOne(S.players);doTrain(S,p.id,pickOne(['lane','farm','team','mind']));}
  else doRest(S);
}
function market(){
  const r=Math.random();
  if(r<0.3&&S.transferWindow>0&&(S.transferList||[]).length){
    const p=pickOne(S.transferList.filter(x=>!x.untouchable&&x.willingness>=30));
    if(p){S.fund+=2000;negoComplete(S,p,500);}
  }else if(r<0.45&&S.market.length){
    S.fund+=2000;buyPlayer(S,S.market[0]);
  }else if(r<0.55&&S.freeAgents&&S.freeAgents.length){
    S.fund+=2000;signFreeAgent(S,S.freeAgents[0].id);
  }else if(r<0.7&&S.transferWindow<=0){
    const c=loanCandidates(S);if(c.length){S.fund+=2000;loanPlayer(S,c[0].from,c[0].p.id);}
  }else if(r<0.8&&S.players.length>6){
    const p=pickOne(S.players.filter(x=>!x.loan&&!S.lineup.includes(x.id)));
    if(p){openSellNego(S,p.id);if(window._sellNego){sellAcceptClub(-1);}}
  }else if(r<0.9){
    S.fund+=2000;recruitRookie(S);
  }else{
    refreshMarket(S);
  }
  badFund('after-market');
}
let seasons=0;
function coachFlow(){
  const bad=unpriced();
  if(bad.length)hits.push({tag:'unpriced',bad:bad.slice(0,5)});
  const rc=(S.retiredCoaches||[]).filter(r=>r.type==='coach');
  const r=Math.random();
  S.fund+=2000;
  if(r<0.4&&rc.length)signRetired(S,rc[0].id);
  else if(r<0.6&&rc.length)hireAssistant(S,rc[0].id);
  else if(r<0.7&&(S.assistants||[]).length)fireAssistant(S,S.assistants[0].id);
  else upgradeSponsor();
  const bad2=unpriced();
  if(bad2.length)hits.push({tag:'unpriced-after',bad:bad2.slice(0,5)});
  badFund('after-coach');
}
for(let step=0;step<900;step++){
  try{
    if(S.phase==='champion'||S.phase==='eliminated'){
      seasons++;if(seasons>=15)break;
      newSeason(S);continue;
    }
    const q=Math.random();
    if(q<0.4)playSeries();
    else if(q<0.6)daily();
    else if(q<0.8)market();
    else coachFlow();
  }catch(e){hits.push({step,err:e.message});if(hits.length>10)break;}
}
return JSON.stringify({season:S.season,fund:S.fund,mode:S.mode,hits:hits.slice(0,8)},null,2);
})()`, dom);
console.log(out);
