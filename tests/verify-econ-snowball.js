// 后期经济滚雪球门禁：代言系数、储备监管费、商业饱和、豪门溢价
// 背景：一年实测资金 5000→5万+ / 12000→14万（year9），打到后面钱随便印、扫货无敌。
// 运行：node tests/verify-econ-snowball.js
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(
  `
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);

  // ① 代言系数必须是 0.3（重构时误写成 1.2 的回归）
  if(ENDORSE_PER_POP!==0.3)fail('ENDORSE_PER_POP 应为 0.3，实为 '+ENDORSE_PER_POP);
  else log('① ENDORSE_PER_POP=0.3（5×80人气 → 周代言约 '+(5*80*0.3)+' 万，不再是工资的几十倍）');

  // ② 储备监管费：弱旅 0，巨款按比例且封顶
  const weak=newState('弱旅','弱');fillRoster(weak,'mid');weak.fund=8000;
  const rich=newState('豪门','富');fillRoster(rich,'star','star');rich.fund=60000;
  const feeW=cashReserveFee(weak), feeR=cashReserveFee(rich), feeHuge=cashReserveFee({fund:999999});
  if(feeW!==0)fail('弱旅（8000）不该交储备费，实收 '+feeW);
  else if(feeR<=0)fail('豪门（60000）应交储备费，实收 '+feeR);
  else if(feeHuge>ECON_RESERVE_FEE_MAX)fail('储备费未封顶: '+feeHuge+' > '+ECON_RESERVE_FEE_MAX);
  else log('② 储备监管费：8000→'+feeW+' · 60000→'+feeR+' · 巨款封顶 '+feeHuge+'/'+ECON_RESERVE_FEE_MAX);

  // ③ 商业饱和：同样粉丝/赞助，钱越多日流水越低
  const mkBiz=fund=>{const s=newState('商','商');fillRoster(s,'mid');s.sponsorLv=3;s.fans=400;s.fund=fund;return dailyCommercialIncome(s);};
  const incPoor=mkBiz(5000), incMid=mkBiz(20000), incRich=mkBiz(80000);
  if(!(incPoor>incMid&&incMid>=incRich))fail('商业流水未随资金递减: 5k='+incPoor+' 20k='+incMid+' 80k='+incRich);
  else if(incRich/incPoor>0.7)fail('饱和折扣不够狠: 80k/5k='+ (incRich/incPoor).toFixed(2) +'（应 ≤0.7）');
  else log('③ 商业饱和：5k '+incPoor+'万/日 → 20k '+incMid+' → 80k '+incRich+'（边际递减）');

  // ④ 豪门溢价：资金越厚，买断价越高（最多 +25%）
  const mkStar=()=>{const d=genFreeAgentDef('mid','star',new Set(['溢价甲']));const p=genPlayer(d);p.willingness=60;return p;};
  const p=mkStar();
  S=newState('溢价探针','溢');fillRoster(S,'mid');S.fund=10000;
  const pricePoor=buyoutPrice(p);
  S.fund=80000;
  const priceRich=buyoutPrice(p);
  if(priceRich<=pricePoor)fail('豪门溢价未生效: 穷 '+pricePoor+' vs 富 '+priceRich);
  else if(priceRich/pricePoor>1.26)fail('溢价超过 25%: '+(priceRich/pricePoor).toFixed(2));
  else log('④ 豪门溢价：1万资金买断 '+pricePoor+' → 8万资金 '+priceRich+'（+'+Math.round((priceRich/pricePoor-1)*100)+'%）');

  // ⑤ 滚雪球斜率：强队 120 天履约，资金增幅必须显著低于旧版（旧版 10 倍）
  let a=42;const _r=Math.random;Math.random=function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
  S=newState('雪球门禁','雪');S.preseason=false;S.transferWindow=0;
  fillRoster(S,'star','star');
  S.sponsorLv=3;S.fans=400;
  S.players.forEach(p=>{p.popularity=85;});
  const f0=S.fund;
  for(let d=0;d<120;d++){
    S.trained=true;S.marketRefreshed=true;S._quietSave=true;nextDay(S);
  }
  Math.random=_r;
  const mult=S.fund/f0;
  if(mult>=6)fail('120 天资金膨胀 '+mult.toFixed(2)+' 倍（目标 <6，旧版约 10 倍）');
  else log('⑤ 120 天强队：'+f0+' → '+Math.round(S.fund)+'（×'+mult.toFixed(2)+'，旧版约 ×10）');

  // ⑥ 巨款后净流入必须明显放缓：高资金再跑 30 天，周均净入应远低于初期
  const midFund=Math.round(S.fund);
  const f1=S.fund;
  for(let d=0;d<30;d++){
    S.trained=true;S.marketRefreshed=true;S._quietSave=true;nextDay(S);
  }
  const lateWeekly=Math.round((S.fund-f1)/30*7);
  const earlyWeekly=Math.round((midFund-f0)/120*7);
  if(lateWeekly>earlyWeekly*0.75)fail('后期周净入未放缓: 早期 '+earlyWeekly+' vs 后期 '+lateWeekly);
  else log('⑥ 净流入递减：早期周均 +'+earlyWeekly+' → 后期周均 +'+lateWeekly);

  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; ')||'未通过');
  return res.join('\\n');
})()
`,
  dom
);

console.log(out);
