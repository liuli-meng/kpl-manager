// 亚运夺冠平衡门禁：中国代表队必须是亚洲第一，金牌率应明显高于任何单一海外队
// 旧平衡（韩国470 vs 中国队裸属性~450）九档实测 1/9 夺金，这里用蒙特卡洛锁回归。
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(
  `
(function(){
  // 年总自动补完会递归到爆栈——本门禁只验亚运对阵，掐断后续赛程
  const _sa=setupAnnual;
  setupAnnual=function(s){s.agDone=true;};
  const N=400;
  const champs={};
  const medals={'金牌':0,'银牌':0,'铜牌':0,'无':0};
  let myPowSum=0, koreaPow=0;
  for(let i=0;i<N;i++){
    S=newState('探针队','剑'); // 全局 S：setupAsianGames 内部 renderAll 要读
    S.fund=20000;
    S.coach=Object.assign({},COACH_POOL.find(c=>c.id==='co12')||COACH_POOL[0]);
    fillRoster(S,'star','star');
    S.preseason=false;S.transferWindow=0;
    S.natCampDay=15;
    S.natSquad=agSelectSquad(S).map(p=>({name:p.name,pos:p.pos,mine:false,ovr:overall(p)}));
    setupAsianGames(S);
    myPowSum+=S.ag.myPow;
    koreaPow=S.aiPower['韩国']||koreaPow;
    let guard=0;
    while(S.phase==='asiad'&&!(S.ag&&S.ag.champ)&&guard++<12)asiadStep(S);
    const a=S.ag;
    if(!a||!a.champ)continue;
    champs[a.champ]=(champs[a.champ]||0)+1;
    medals[a.medal]=(medals[a.medal]||0)+1;
  }
  const goldRate=(medals['金牌']||0)/N;
  const chinaGold=champs['中国代表队']||0;
  const otherMax=Math.max(0,...Object.entries(champs).filter(([k])=>k!=='中国代表队').map(([,v])=>v));
  const lines=[];
  lines.push('样本 '+N+' · 中国队均战力 '+Math.round(myPowSum/N)+' · 韩国战力 '+koreaPow);
  lines.push('金牌分布: '+JSON.stringify(medals));
  lines.push('冠军分布: '+JSON.stringify(champs));
  if(goldRate<0.40)throw new Error('中国队金牌率过低: '+(goldRate*100).toFixed(1)+'% (<40%) · '+JSON.stringify(champs));
  if(chinaGold<=otherMax)throw new Error('中国金牌数未压过最强海外队: 中国='+chinaGold+' 最高海外='+otherMax+' · '+JSON.stringify(champs));
  const avgPow=myPowSum/N;
  if(avgPow<=koreaPow)throw new Error('中国均战力未超过韩国: 中国='+avgPow+' 韩国='+koreaPow);
  return lines.join('\\n');
})()
`,
  dom
);

console.log(out);
