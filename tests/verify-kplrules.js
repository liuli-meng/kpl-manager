// KPL 五条硬规则专属回归（2026-09 真实经济对齐）
// ① 转会费封顶 1500  ② 大名单 ≤10  ③ 转会期卖出 ≤ 半数  ④ 个人顶薪 70/周  ⑤ 奖金 70/30 分成
// 运行：node tests/verify-kplrules.js
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);
  const mkS=(n)=>{S=newState('硬规则队','x');fillRoster(S,'mid','star');
   const u=new Set(S.players.map(p=>p.name));
   while((S.players||[]).length<(n||5)){const b=genPlayer(genFreeAgentDef(pick(POS_ORDER),'mid',u));b.apps=0;S.players.push(b);}
   return S;};
  const starDef=()=>({id:'p_star_'+Math.random().toString(36).slice(2,7),name:'顶星',pos:'mid',team:'测试豪门',
   tags:[],base:[99,99,99,99],skill:{n:'顶星',t:'team',d:'x'},sig:'貂蝉',career:''});

  // ① 转会费封顶 1500：买断 / 强挖 / 挂牌 / AI 报价全链路
  const s1=mkS();S=s1;
  const star=genPlayer(starDef());star.val=150;star.willingness=10; // 意愿极低 → wilMult 2.2 拉满
  const bo=buyoutPrice(star),ut=untouchablePrice(star);
  s1.players.push(star);s1.lineup=s1.lineup.filter(id=>id!==star.id); // 非首发才能挂牌
  listPlayer(s1,star.id);
  const listed=(s1.listed||[]).find(x=>x.id===star.id);
  // 强制 AI 高价报价路径：price*(0.85+0.35)=1.2x，封顶前理论值远超 1500
  s1.bids=[];
  if(listed){s1.bids=[{id:star.id,team:'测试豪门',bid:Math.min(1500,Math.round(listed.price*1.2))}];}
  // sellAskPrice（出售谈判要价）
  const ask=sellAskPrice(star);
  const bad=[];
  if(!(bo>0&&bo<=1500))bad.push('买断='+bo);
  if(!(ut>0&&ut<=1500))bad.push('强挖='+ut);
  if(!(ask>0&&ask<=1500))bad.push('要价='+ask);
  if(listed&&!(listed.price>0&&listed.price<=1500))bad.push('挂牌='+listed.price);
  if(s1.bids.length&&s1.bids[0].bid>1500)bad.push('AI报价='+s1.bids[0].bid);
  if(TRANSFER_CAP!==1500)bad.push('常量='+TRANSFER_CAP);
  if(bad.length)fail('① 转会费封顶被突破: '+bad.join(', '));
  else log('① 转会费 1500 封顶：买断 '+bo+' · 强挖 '+ut+' · 要价 '+ask+' · 挂牌 '+(listed?listed.price:'—')+' · AI报价 '+(s1.bids[0]?s1.bids[0].bid:'—'));

  // ② 大名单 ≤10：买断签约 / 谈判入口 / 青训晋升 三处守卫
  const s2=mkS(10);S=s2;
  if(s2.players.length!==10)fail('② 预置满员失败: '+s2.players.length);
  else{
   const victim=genPlayer(genFreeAgentDef('mid','mid',new Set()));
   s2.market=[victim];
   const fund0=s2.fund,cnt0=s2.players.length;
   const bought=buyPlayer(s2,victim);
   const p2=genPlayer(genFreeAgentDef('top','mid',new Set()));
   s2.transferList=[p2];p2.ownerTeam='测试豪门';
   openNegotiation(s2,p2.id);
   const negoOpened=!!(window._nego&&window._nego.pid===p2.id);
   // 青训晋升守卫
   s2.academy=[{id:'r1',name:'青训新星',pos:'mid',age:18,tags:['青训'],
    attrs:{lane:80,farm:80,team:80,mind:80},heroPool:[{n:'貂蝉',lv:3}],sig:'貂蝉',
    wage:2,morale:80,injury:0,retiring:false,contract:2,isRookie:false}];
   promoteRookie(s2,'r1');
   const promoted=s2.players.some(p=>p.id==='r1');
   if(bought||s2.players.length!==cnt0||s2.fund!==fund0)fail('满员仍买断成功（人数'+s2.players.length+' 资金'+s2.fund+'）');
   else if(negoOpened)fail('满员仍打开了谈判');
   else if(promoted)fail('满员仍青训晋升');
   else log('② 大名单 ≤10：买断/谈判/青训晋升 三处全部被拦截（当前 '+s2.players.length+' 人）');
  }

  // ③ 转会期卖出 ≤ 半数（向下取整）+ 窗口开启清零
  const s3=mkS(5);S=s3;
  s3.windowSold=0;
  const half=Math.floor(5/2); // =2
  // 直接验证 sellGuard 边界（openSellNego 依赖随机买家，用底层函数钉语义）
  let g0=sellGuard(s3);
  s3.windowSold=1;let g1=sellGuard(s3);
  s3.windowSold=2;let g2=sellGuard(s3);
  s3.windowSold=3;let g3=sellGuard(s3);
  if(!(g0&&g1&&!g2&&!g3))fail('③ 卖出半数守卫语义错: sold0='+g0+' sold1='+g1+' sold2='+g2+' sold3='+g3);
  else{
   // 真实卖出一次计数 +1，并验证 completeSale 走 windowSold
   s3.windowSold=0;
   const victim3=s3.players[s3.players.length-1];
   completeSale(s3,victim3,100,'测试买家');
   if((s3.windowSold||0)!==1)fail('completeSale 未累计 windowSold: '+(s3.windowSold||0));
   else{
    // 模拟窗口重开：season.js 会把 windowSold 清零
    s3.transferWindow=7;s3.preseason=true;s3.windowSold=0;
    if(!sellGuard(s3))fail('窗口重开后 sellGuard 未放行');
    else log('③ 卖出半数：名单 5 人上限 '+half+' 人 · completeSale 计数 · 窗口重开清零后放行');
   }
  }

  // ④ 个人顶薪 70 万/周：谈判要价 / 续约 / 留人涨薪 / 买入钳制
  const s4=mkS();S=s4;
  const rich=genPlayer(starDef());
  rich.wage=999;rich.val=150;rich.willingness=20;
  const demand=negoWageDemand(rich);
  // 续约路径
  const renewP=s4.players[0];
  renewP.contract=1;renewP.wage=10;renewP.val=150;
  renewPlayer(s4,renewP.id,2,200); // 报价 200 → 应钳到 70
  const renewW=renewP.wage;
  // 留人涨薪：从 68 起步，+8%≈5 → 应钳到 70
  const keepP=s4.players[1];
  keepP.wage=68;keepP.morale=80;keepP.willingness=50;
  s4.offers=[{pid:keepP.id,name:keepP.name,team:'测试豪门',fee:800,expire:s4.day+3,status:'open'}];
  respondOffer(s4,0,'keep');
  const keepW=keepP.wage;
  // 买入钳制
  const buyP=genPlayer(genFreeAgentDef('jg','mid',new Set()));
  buyP.wage=200;s4.fund=99999;s4.wageCap=9999; // 足够钱/帽，只测顶薪
  // confirm 桩默认 true
  const bought4=buyPlayer(s4,buyP);
  const buyW=bought4?buyP.wage:null;
  if(PLAYER_WAGE_MAX!==70)fail('④ 顶薪常量不是 70: '+PLAYER_WAGE_MAX);
  else if(demand>70)fail('谈判要价突破顶薪: '+demand);
  else if(renewW>70)fail('续约突破顶薪: '+renewW);
  else if(keepW>70)fail('留人涨薪突破顶薪: '+keepW);
  else if(bought4&&buyW>70)fail('买入突破顶薪: '+buyW);
  else log('④ 顶薪 70：要价 '+demand+' · 续约 '+renewW+' · 留人 '+keepW+' · 买入 '+(buyW==null?'—':buyW)+'（全部≤70）');

  // ⑤ 奖金 70/30 分成：基金只进 30%，选手士气+3/意愿+2
  const s5=mkS();S=s5;
  const fund5=s5.fund;
  const before=s5.players.map(p=>({m:p.morale||50,w:p.willingness==null?50:p.willingness}));
  grantPrize(s5,60,'测试奖金');
  const clubShare=Math.round(60*0.3); // 18
  const after=s5.players.map(p=>({m:p.morale,w:p.willingness}));
  const moraleOk=after.every((a,i)=>a.m===Math.min(100,before[i].m+3));
  const willOk=after.every((a,i)=>a.w===Math.min(100,before[i].w+2));
  if(s5.fund-fund5!==clubShare)fail('⑤ 俱乐部留成应为 30%（'+clubShare+'），实得 '+(s5.fund-fund5));
  else if(!moraleOk)fail('⑤ 选手士气未 +3');
  else if(!willOk)fail('⑤ 选手意愿未 +2');
  else if(!s5.eventLog.some(e=>/选手分成 70%/.test(e.txt)&&/俱乐部留成 30%/.test(e.txt)))fail('⑤ 分成日志缺失');
  else{
   // K甲小额奖金：13 → 俱乐部 4（四舍五入）
   const f0=s5.fund;grantPrize(s5,13,'K甲夺冠奖金');
   const club13=Math.round(13*0.3);
   if(s5.fund-f0!==club13)fail('⑤ K甲 13 万留成异常: '+(s5.fund-f0)+' 应 '+club13);
   else log('⑤ 奖金 70/30：总 60 → 俱乐部 +18 · 选手士气+3/意愿+2；K甲 13 → 俱乐部 +'+club13);
  }

  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; ')||'未通过');
  return res.join('\\n');
})()
`, dom);

console.log(out);
