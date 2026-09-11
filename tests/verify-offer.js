// 赛中转会报价回归：触发门槛 / 留人涨薪 / 放人联动粉丝与更衣室 / 抬价三结局 / 过期 / 面板
// 运行：node tests/verify-offer.js
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);
  const mkS=()=>{S=newState('报价队','x');fillRoster(S,'mid','star');
   const u=new Set(S.players.map(p=>p.name));
   const b=genPlayer(genFreeAgentDef(pick(POS_ORDER),'mid',u));b.apps=0;S.players.push(b);
   return S;};
  const realRandom=Math.random;
  const setRnd=f=>{Math.random=f;};

  // ① 触发门槛：表现火热（val≥112）的首发才会被盯上；K甲/租借/低迷选手被排除
  const s1=mkS();S=s1;
  const star=s1.lineup.map(id=>s1.players.find(p=>p.id===id)).sort((a,b)=>overall(b)-overall(a))[0];
  star.val=130;star.morale=80;
  let hits=0;
  for(let i=0;i<400&&hits===0;i++)inSeasonOfferTick(s1);
  if(s1.offers.length!==1)fail('火热顶星 400 天内未产生报价（概率异常）');
  else{
   const o=s1.offers[0];
   if(o.pid!==star.id)fail('报价对象错误');
   else if(!(o.fee>0&&o.expire===s1.day+OFFER_TTL))fail('报价字段异常: '+JSON.stringify(o));
   else if(!s1.eventLog.some(e=>/赛中报价/.test(e.txt)))fail('报价未写事件日志');
   else{
    // 排除项：K甲/租借/低迷
    const bench=s1.players.find(p=>p.id!==star.id&&!s1.lineup.includes(p.id));
    bench.val=130;sendKjia(s1,bench.id);
    const low=s1.players.find(p=>p.id!==star.id&&p.id!==bench.id&&s1.lineup.includes(p.id));
    low.val=80;
    inSeasonOfferTick(s1);
    if(s1.offers.some(x=>x.pid===bench.id))fail('K甲锻炼中的选手不该收到报价');
    else if(s1.offers.some(x=>x.pid===low.id))fail('表现低迷的选手不该收到报价');
    else log('① 触发与门槛：火热顶星（val 130）收到 '+o.team+' 报价 '+o.fee+'万（3天有效）；K甲/低迷选手被排除');
   }
  }

  // ② 留人：涨薪约 8%、士气+5、忠诚+5，报价清除，阵容不动
  const s2=mkS();S=s2;
  const p2=s2.players[0];p2.val=130;p2.wage=100;p2.morale=80;p2.willingness=50;
  s2.offers=[{pid:p2.id,name:p2.name,team:'测试豪门',fee:2000,expire:s2.day+3,status:'open'}];
  respondOffer(s2,0,'keep');
  if(s2.offers.length)fail('留人后报价未清除');
  else if(p2.wage!==108)fail('留人涨薪异常（期望 ~8%）: '+p2.wage);
  else if(p2.morale!==85||p2.willingness!==55)fail('留人安抚未生效: 士气'+p2.morale+' 忠诚'+p2.willingness);
  else if(!s2.players.some(x=>x.id===p2.id))fail('留人把选手弄丢了');
  else log('② 留人：回绝报价并涨薪 100→108万/周（士气+5 · 忠诚+5），选手留队');

  // ③ 放人：转会费入账、选手去买家、粉丝失望、队友寒心、首发空缺提示
  const s3=mkS();S=s3;
  s3.fans=50; // 预置粉丝基数（ newState 默认 0，扣无可扣会掩盖联动断言）
  const p3=s3.players[0];p3.val=130;p3.popularity=48;
  s3.offers=[{pid:p3.id,name:p3.name,team:'测试豪门',fee:2500,expire:s3.day+3,status:'open'}];
  const fund3=s3.fund,fans3=s3.fans;
  const morSum3=s3.players.reduce((t,x)=>t+x.morale,0);
  const cnt3=s3.players.length;
  respondOffer(s3,0,'sell');
  const fanHit3=Math.min(5,Math.max(1,Math.round(p3.popularity/12)));
  if(s3.players.some(x=>x.id===p3.id))fail('放人后选手还在阵中');
  else if(s3.fund-fund3!==2500)fail('转会费未入账: +'+(s3.fund-fund3));
  else if(s3.fans>fans3-1)fail('放人未得罪粉丝');
  else if(Math.abs((fans3-s3.fans)-fanHit3)>0.01)fail('粉丝流失量与人气不匹配: -'+(fans3-s3.fans)+' 期望 -'+fanHit3);
  else if(s3.players.reduce((t,x)=>t+x.morale,0)!==morSum3-p3.morale-4*(cnt3-1))fail('更衣室士气未受影响');
  else log('③ 放人：+2500万 入账 · 粉丝 -'+fanHit3+'万（人气联动）· 其余队员士气各 -4（更衣室寒心）');

  // ④ 抬价三结局（固定随机数逐一验证）：
  const s4=mkS();S=s4;
  const p4=s4.players[0];p4.val=130;
  // 4a roll=0.5<0.55 → 加价成交
  s4.offers=[{pid:p4.id,name:p4.name,team:'测试豪门',fee:2000,expire:s4.day+3,status:'open'}];
  const fund4=s4.fund;
  setRnd(()=>0.5);
  respondOffer(s4,0,'counter');
  setRnd(realRandom);
  const ask4=Math.round(2000*(1.2+0.5*0.15));
  if(s4.players.some(x=>x.id===p4.id))fail('抬价成交后选手未离队');
  else if(s4.fund-fund4!==ask4)fail('加价成交金额异常: +'+(s4.fund-fund4)+' 期望 '+ask4);
  else log('④a 抬价→成交：买家接受 '+ask4+'万（原报价 2000万），按加价后的转会费结算');
  // 4b roll=0.7 → 最终报价
  const s4b=mkS();S=s4b;
  const p4b=s4b.players[0];p4b.val=130;
  s4b.offers=[{pid:p4b.id,name:p4b.name,team:'测试豪门',fee:2000,expire:s4b.day+3,status:'open'}];
  setRnd(()=>0.7);
  respondOffer(s4b,0,'counter');
  setRnd(realRandom);
  if(s4b.offers[0]&&s4b.offers[0].status==='final'&&s4b.players.some(x=>x.id===p4b.id))log('④b 抬价→最终报价：买家锁价 '+s4b.offers[0].fee+'万，选手留队待答复');
  else fail('最终报价结局异常: '+JSON.stringify(s4b.offers));
  // 4c roll=0.9 → 买家离场 + 士气受挫
  const s4c=mkS();S=s4c;
  const p4c=s4c.players[0];p4c.val=130;p4c.morale=80;
  s4c.offers=[{pid:p4c.id,name:p4c.name,team:'测试豪门',fee:2000,expire:s4c.day+3,status:'open'}];
  setRnd(()=>0.9);
  respondOffer(s4c,0,'counter');
  setRnd(realRandom);
  if(s4c.offers.length)fail('买家离场后报价仍在');
  else if(!s4c.players.some(x=>x.id===p4c.id))fail('离场结局不该出售选手');
  else if(p4c.morale!==76)fail('抬价离场未影响士气: '+p4c.morale);
  else log('④c 抬价→离场：买家退出谈判，选手留队但士气 -4（80→76）');

  // ⑤ 报价过期：TTL 天后无人答复自动作废
  const s5=mkS();S=s5;
  const p5=s5.players[0];
  s5.offers=[{pid:p5.id,name:p5.name,team:'测试豪门',fee:1500,expire:s5.day+OFFER_TTL,status:'open'}];
  for(let i=0;i<OFFER_TTL+1;i++)nextDay(s5);
  if(s5.offers.length)fail('过期报价未作废');
  else if(!s5.eventLog.some(e=>/报价到期/.test(e.txt)))fail('过期未写日志');
  else log('⑤ 过期作废：'+OFFER_TTL+' 天未答复的报价自动清理并广播');

  // ⑥ 俱乐部页面板渲染 + 旧档兜底
  const s6=mkS();S=s6;
  s6.offers=undefined; // 模拟旧档
  migrateSave();
  const p6=s6.players[0];
  s6.offers=[{pid:p6.id,name:p6.name,team:'测试豪门',fee:1800,expire:s6.day+3,status:'open'}];
  let rErr='';
  try{goPage('club');}catch(e){rErr=e.message;}
  const body=document.querySelector('#page-club').innerHTML;
  if(rErr)fail('俱乐部页渲染异常: '+rErr);
  else if(!body.includes('赛中转会报价'))fail('俱乐部页缺少赛中报价面板');
  else if(!body.includes("respondOffer(S,0,'counter')"))fail('抬价按钮缺失');
  else if(!body.includes("respondOffer(S,0,'keep')"))fail('留人按钮缺失');
  else log('⑥ 面板与兼容：旧档 offers 兜底迁移，俱乐部页报价面板三按钮渲染齐全');

  setRnd(realRandom);
  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; ')||'未通过');
  return res.join('\\n');
})()
`, dom);

console.log(out);
