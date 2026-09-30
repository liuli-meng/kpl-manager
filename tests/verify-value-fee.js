// 选手身价扣费门禁：买断/直签/续约必须按身价扣款，禁止 0 元白拿
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);

  // ① 市场买人：扣 valueOf
  S=newState('买队','买');fillRoster(S,'mid');S.fund=20000;
  S.preseason=false;S.transferWindow=3;
  const p=genPlayer(genFreeAgentDef('mid','star',new Set(['测试星'])));
  S.market=[p];
  const cost=Math.round(valueOf(overall(p)));
  const f0=S.fund;const ok=buyPlayer(S,p);const paid=Math.round(f0-S.fund);
  if(!ok||paid!==cost)fail('买人扣费错误: cost='+cost+' paid='+paid);
  else log('① 买人按身价扣 '+paid+' 万');

  // ② 自由球员缺 signCost：必须按身价 58 折扣款，不得 0
  S=newState('自由队','自');fillRoster(S,'mid');S.fund=20000;
  S.preseason=false;S.transferWindow=3;
  const fa=genPlayer(genFreeAgentDef('mid','mid',new Set(['测试由'])));
  delete fa.signCost;
  S.freeAgents=[fa];
  const expect=Math.round(valueOf(overall(fa))*0.58);
  const f1=S.fund;signFreeAgent(S,fa.id);const paid2=Math.round(f1-S.fund);
  if(paid2<=0)fail('缺 signCost 时 0 元白拿');
  else if(Math.abs(paid2-expect)>2)fail('缺 signCost 扣价偏差: expect~'+expect+' paid='+paid2);
  else log('② 缺 signCost 自动按身价扣 '+paid2+' 万');

  // ③ signCostOf：0/负/NaN 都回落身价
  const bad=genPlayer(genFreeAgentDef('mid','low',new Set(['测试坏'])));
  bad.signCost=0;
  const v1=signCostOf(bad);
  bad.signCost=-5;const v2=signCostOf(bad);
  bad.signCost=NaN;const v3=signCostOf(bad);
  if(!(v1>0&&v2>0&&v3>0))fail('signCostOf 未兜底: '+v1+'/'+v2+'/'+v3);
  else log('③ signCostOf 对 0/负/NaN 回落身价 → '+v1);

  // ④ 续约签字费按 renewCost 扣
  S=newState('续队','续');fillRoster(S,'star');S.fund=20000;
  S.preseason=false;S.transferWindow=3;
  const r=S.players[0];r.contract=1;
  const rc=renewCostN(r,2);
  const f3=S.fund;renewPlayer(S,r.id,2);const paid4=Math.round(f3-S.fund);
  if(paid4!==rc)fail('续约扣费错误: expect='+rc+' paid='+paid4);
  else log('④ 续约签字费 '+paid4+' 万');

  // ⑤ 转会谈判扣转会费
  S=newState('谈队','谈');fillRoster(S,'mid');S.fund=30000;
  S.preseason=false;S.transferWindow=3;
  const t=genPlayer(genFreeAgentDef('mid','star',new Set(['测试援'])));
  t.ownerTeam='重庆狼队';t.willingness=70;t.wage=80;
  S.transferList=[t];
  const fee=Math.round(buyoutPrice(t));
  const f4=S.fund;S.fund-=fee;negoComplete(S,t,fee);
  const paid5=Math.round(f4-S.fund);
  if(paid5!==fee||t.acqCost!==fee)fail('谈判扣费/acqCost 错误: fee='+fee+' paid='+paid5+' acq='+t.acqCost);
  else log('⑤ 转会买断 '+paid5+' 万 · acqCost 已锚定');

  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; ')||'未通过');
  return res.join('\\n');
})()
`, dom);

console.log(out);
