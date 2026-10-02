// ⚠ 诊断脚本，非门禁：仅用于调试与打印身价/买断费/签约费计算抽样，不包含断言
const { makeDom } = require('./harness');
const vm = require('vm');
const { dom } = makeDom();
const out = vm.runInContext(`
(function(){
  const res=[];
  function push(k,v){res.push(k+': '+v);}

  // ① 市场 buyPlayer：必须按 valueOf 身价扣款
  S=newState('身价队','身');fillRoster(S,'mid');S.fund=20000;
  S.preseason=false;S.transferWindow=3;
  const p=genPlayer(genFreeAgentDef('mid','star',new Set(['测试星'])));
  S.market=[p];
  const cost=Math.round(valueOf(overall(p))*(p.discount||1));
  const f0=S.fund;
  const ok=buyPlayer(S,p);
  const paid=Math.round(f0-S.fund);
  push('buyPlayer', ok+' cost='+cost+' paid='+paid+' match='+(paid===cost));

  // ② 自由球员 signFreeAgent：扣 signCost
  S=newState('自由队','自');fillRoster(S,'mid');S.fund=20000;
  S.preseason=false;S.transferWindow=3;
  const fa=genPlayer(genFreeAgentDef('mid','mid',new Set(['测试由'])));
  fa.signCost=Math.round(valueOf(overall(fa))*0.58);
  S.freeAgents=[fa];
  const f1=S.fund;
  signFreeAgent(S,fa.id);
  const paid2=Math.round(f1-S.fund);
  push('signFreeAgent', 'signCost='+fa.signCost+' paid='+paid2+' match='+(paid2===Math.round(valueOf(overall(fa))*0.58)));

  // ③ 转会谈判 negoComplete 路径：fund-=fee
  S=newState('转会队','转');fillRoster(S,'mid');S.fund=20000;
  S.preseason=false;S.transferWindow=3;
  const t=genPlayer(genFreeAgentDef('mid','star',new Set(['测试援'])));
  t.ownerTeam='重庆狼队';t.willingness=70;t.wage=80;t.id='ns_'+t.id;
  S.transferList=[t];
  const ask=buyoutPrice(t);
  const f2=S.fund;
  // 直接调 negoComplete 之前先扣费（模拟成交路径）
  const fee=Math.round(ask*1.0);
  S.fund-=fee;
  negoComplete(S,t,fee);
  const paid3=Math.round(f2-S.fund);
  push('nego path', 'ask='+ask+' fee='+fee+' paid='+paid3+' acqCost='+(t.acqCost||t.acqCost===0?t.acqCost:'null'));

  // ④ 续约签字费
  S=newState('续约队','续');fillRoster(S,'star');S.fund=20000;
  S.preseason=false;S.transferWindow=3;
  const r=S.players[0];
  r.contract=1;
  const rc=renewCostN(r,2);
  const f3=S.fund;
  renewPlayer(S,r.id,2);
  const paid4=Math.round(f3-S.fund);
  push('renewPlayer', 'renewCost='+rc+' paid='+paid4+' match='+(paid4===rc));

  // ⑤ signFreeAgent 缺 signCost 时是否漏扣
  S=newState('缺价队','缺');fillRoster(S,'mid');S.fund=20000;
  S.preseason=false;S.transferWindow=3;
  const fa2=genPlayer(genFreeAgentDef('mid','mid',new Set(['测试缺'])));
  delete fa2.signCost;
  S.freeAgents=[fa2];
  const f4=S.fund;
  signFreeAgent(S,fa2.id);
  const paid5=Math.round(f4-S.fund);
  push('missing signCost', 'paid='+paid5+' signCostAfter='+(fa2.signCost));

  // ⑥ 青训提拔/紧急补签是否收身价
  S=newState('青训队','青');fillRoster(S,'mid');S.fund=20000;
  S.preseason=false;S.transferWindow=0;
  const f5=S.fund;
  try{emergencyFillRoster(S);}catch(e){push('emerg', e.message);}
  push('emergencyFill', 'paid='+Math.round(f5-S.fund)+' roster='+S.players.length);

  return res.join('\\n');
})()
`, dom);
console.log(out);
